import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

import type { DetectedPlatform } from "../platforms.js";
import {
  backupPath,
  copyDir,
  copyFile,
  isDir,
  isFile,
  readFileIfExists,
  writeFileSafe,
} from "../utils/fs.js";
import {
  mergeJsonc,
  parseJsonc,
  stringifyJsonc,
} from "../utils/jsonc.js";
import { log } from "../utils/log.js";

export type SyncKind = "settings" | "keybindings" | "tasks" | "snippets";

export const SYNC_KINDS: SyncKind[] = [
  "settings",
  "keybindings",
  "tasks",
  "snippets",
];

export interface SyncFilesOptions {
  kinds: SyncKind[];
  /** When true, deep-merge JSONC files instead of overwriting. */
  merge: boolean;
  /** When true, do not write — only report what would change. */
  dryRun: boolean;
  /** Root directory to write timestamped backups under (per-target). */
  backupRoot: string;
  /** Skip backups entirely (dangerous). */
  noBackup: boolean;
}

export interface SyncFileResult {
  kind: SyncKind;
  target: string;
  action: "wrote" | "merged" | "skipped" | "would-write" | "would-merge";
  bytes?: number;
  files?: number;
}

function userPath(p: DetectedPlatform, ...rest: string[]): string {
  return join(p.paths.userDataDir, ...rest);
}

function syncJsoncFile(
  label: SyncKind,
  fromPath: string,
  toPath: string,
  opts: SyncFilesOptions,
  targetLabel: string,
): SyncFileResult | undefined {
  if (!isFile(fromPath)) return undefined;

  const sourceText = readFileIfExists(fromPath);
  if (sourceText === undefined) return undefined;

  // Decide write vs merge.
  const targetExists = isFile(toPath);
  const willMerge = opts.merge && targetExists;

  if (opts.dryRun) {
    return {
      kind: label,
      target: toPath,
      action: willMerge ? "would-merge" : "would-write",
      bytes: sourceText.length,
    };
  }

  if (!opts.noBackup && targetExists) {
    backupPath(toPath, opts.backupRoot, `${targetLabel}/${label}.json`);
  }

  let finalText = sourceText;
  if (willMerge) {
    const targetText = readFileIfExists(toPath) ?? "{}";
    try {
      const baseObj = parseJsonc<Record<string, unknown>>(targetText);
      const incomingObj = parseJsonc<Record<string, unknown>>(sourceText);
      // keybindings.json is an array — merging means concatenating then
      // deduplicating by stringified entry.
      if (Array.isArray(baseObj) || Array.isArray(incomingObj)) {
        const baseArr = Array.isArray(baseObj) ? baseObj : [];
        const incArr = Array.isArray(incomingObj) ? incomingObj : [];
        const seen = new Set<string>();
        const merged: unknown[] = [];
        for (const item of [...baseArr, ...incArr]) {
          const key = JSON.stringify(item);
          if (seen.has(key)) continue;
          seen.add(key);
          merged.push(item);
        }
        finalText = stringifyJsonc(merged);
      } else {
        const merged = mergeJsonc(baseObj, incomingObj);
        finalText = stringifyJsonc(merged);
      }
    } catch (err) {
      log.warn(
        `Could not merge ${label} (parse error: ${
          (err as Error).message
        }). Falling back to overwrite.`,
      );
    }
  }

  writeFileSafe(toPath, finalText);
  return {
    kind: label,
    target: toPath,
    action: willMerge ? "merged" : "wrote",
    bytes: finalText.length,
  };
}

function syncSnippets(
  from: DetectedPlatform,
  to: DetectedPlatform,
  opts: SyncFilesOptions,
): SyncFileResult | undefined {
  const fromDir = userPath(from, "snippets");
  const toDir = userPath(to, "snippets");
  if (!isDir(fromDir)) return undefined;

  if (opts.dryRun) {
    let count = 0;
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.isFile()) count++;
      }
    };
    walk(fromDir);
    return {
      kind: "snippets",
      target: toDir,
      action: "would-write",
      files: count,
    };
  }

  if (!opts.noBackup && existsSync(toDir)) {
    backupPath(toDir, opts.backupRoot, `${to.def.id}/snippets`);
  }

  const copied = copyDir(fromDir, toDir, /* overwrite */ true);
  return { kind: "snippets", target: toDir, action: "wrote", files: copied };
}

export function syncFiles(
  from: DetectedPlatform,
  to: DetectedPlatform,
  opts: SyncFilesOptions,
): SyncFileResult[] {
  const results: SyncFileResult[] = [];
  const targetLabel = to.def.id;

  for (const kind of opts.kinds) {
    if (kind === "snippets") {
      const r = syncSnippets(from, to, opts);
      if (r) results.push(r);
      continue;
    }
    const filename =
      kind === "settings"
        ? "settings.json"
        : kind === "keybindings"
          ? "keybindings.json"
          : "tasks.json";
    const fromPath = userPath(from, filename);
    const toPath = userPath(to, filename);
    const r = syncJsoncFile(kind, fromPath, toPath, opts, targetLabel);
    if (r) results.push(r);
  }

  return results;
}

/** Copy a path verbatim (used for export/import bundles). */
export function copyAny(src: string, dest: string): boolean {
  if (!existsSync(src)) return false;
  if (isDir(src)) {
    copyDir(src, dest, true);
    return true;
  }
  if (isFile(src)) {
    copyFile(src, dest);
    return true;
  }
  return false;
}
