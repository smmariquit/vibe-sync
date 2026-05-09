import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

import type { DetectedPlatform } from "../platforms.js";
import { backupPath, copyDir, copyFile, isDir, isFile, readFileIfExists, writeFileSafe } from "../utils/fs.js";
import { mergeJsonc, parseJsonc, stringifyJsonc } from "../utils/jsonc.js";
import { log } from "../utils/log.js";

export type SyncKind = "settings" | "keybindings" | "tasks" | "snippets";

export const SYNC_KINDS: SyncKind[] = ["settings", "keybindings", "tasks", "snippets"];

export interface SyncFilesOptions {
  kinds: SyncKind[];
  merge: boolean;
  dryRun: boolean;
  backupRoot: string;
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

  const targetExists = isFile(toPath);
  const willMerge = opts.merge && targetExists;

  if (opts.dryRun) {
    return { kind: label, target: toPath, action: willMerge ? "would-merge" : "would-write", bytes: sourceText.length };
  }

  if (!opts.noBackup && targetExists) {
    backupPath(toPath, opts.backupRoot, `${targetLabel}/${label}.json`);
  }

  let finalText = sourceText;
  if (willMerge) {
    const targetText = readFileIfExists(toPath) ?? "{}";
    try {
      const base = parseJsonc<Record<string, unknown>>(targetText);
      const incoming = parseJsonc<Record<string, unknown>>(sourceText);
      if (Array.isArray(base) || Array.isArray(incoming)) {
        const seen = new Set<string>();
        const merged: unknown[] = [];
        for (const item of [...(Array.isArray(base) ? base : []), ...(Array.isArray(incoming) ? incoming : [])]) {
          const key = JSON.stringify(item);
          if (seen.has(key)) continue;
          seen.add(key);
          merged.push(item);
        }
        finalText = stringifyJsonc(merged);
      } else {
        finalText = stringifyJsonc(mergeJsonc(base, incoming));
      }
    } catch (err) {
      log.warn(`Could not merge ${label} (${(err as Error).message}), falling back to overwrite.`);
    }
  }

  writeFileSafe(toPath, finalText);
  return { kind: label, target: toPath, action: willMerge ? "merged" : "wrote", bytes: finalText.length };
}

function syncSnippets(from: DetectedPlatform, to: DetectedPlatform, opts: SyncFilesOptions): SyncFileResult | undefined {
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
    return { kind: "snippets", target: toDir, action: "would-write", files: count };
  }

  if (!opts.noBackup && existsSync(toDir)) {
    backupPath(toDir, opts.backupRoot, `${to.def.id}/snippets`);
  }

  const copied = copyDir(fromDir, toDir, true);
  return { kind: "snippets", target: toDir, action: "wrote", files: copied };
}

export function syncFiles(from: DetectedPlatform, to: DetectedPlatform, opts: SyncFilesOptions): SyncFileResult[] {
  const results: SyncFileResult[] = [];
  const targetLabel = to.def.id;

  for (const kind of opts.kinds) {
    if (kind === "snippets") {
      const r = syncSnippets(from, to, opts);
      if (r) results.push(r);
      continue;
    }
    const filename = kind === "settings" ? "settings.json" : kind === "keybindings" ? "keybindings.json" : "tasks.json";
    const r = syncJsoncFile(kind, userPath(from, filename), userPath(to, filename), opts, targetLabel);
    if (r) results.push(r);
  }

  return results;
}

export function copyAny(src: string, dest: string): boolean {
  if (!existsSync(src)) return false;
  if (isDir(src)) { copyDir(src, dest, true); return true; }
  if (isFile(src)) { copyFile(src, dest); return true; }
  return false;
}
