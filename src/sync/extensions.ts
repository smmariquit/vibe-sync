import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { isIncompatible, type DetectedPlatform, type PlatformId } from "../platforms.js";
import { log } from "../utils/log.js";

export interface ExtensionInfo {
  id: string;
  version?: string;
  source: "cli" | "fs";
}

function findCliBin(p: DetectedPlatform): string | undefined {
  for (const bin of p.def.cliBin) {
    const result = spawnSync(process.platform === "win32" ? "where" : "which", [bin]);
    if (result.status === 0) return bin;
  }
  return undefined;
}

export function listExtensions(p: DetectedPlatform): ExtensionInfo[] {
  const bin = findCliBin(p);
  if (bin) {
    const res = spawnSync(bin, ["--list-extensions", "--show-versions"], { encoding: "utf8" });
    if (res.status === 0 && res.stdout) return parseCliList(res.stdout);
    log.warn(`${p.def.displayName}: '${bin} --list-extensions' failed (${res.status}), falling back to filesystem scan.`);
  }
  return scanExtensionsDir(p.paths.extensionsDir);
}

function parseCliList(stdout: string): ExtensionInfo[] {
  const out: ExtensionInfo[] = [];
  for (const raw of stdout.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const at = line.lastIndexOf("@");
    if (at > 0) {
      out.push({ id: line.slice(0, at).toLowerCase(), version: line.slice(at + 1), source: "cli" });
    } else {
      out.push({ id: line.toLowerCase(), source: "cli" });
    }
  }
  return dedupe(out);
}

function scanExtensionsDir(dir: string): ExtensionInfo[] {
  if (!existsSync(dir)) return [];
  const out: ExtensionInfo[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
    const full = join(dir, entry.name);
    const manifest = join(full, "package.json");
    if (existsSync(manifest)) {
      try {
        const pkg = JSON.parse(readFileSync(manifest, "utf8")) as { publisher?: string; name?: string; version?: string };
        if (pkg.publisher && pkg.name) {
          out.push({ id: `${pkg.publisher}.${pkg.name}`.toLowerCase(), version: pkg.version, source: "fs" });
          continue;
        }
      } catch {
        // fall through
      }
    }
    const m = entry.name.match(/^([^.]+)\.(.+)-(\d+\.\d+\.\d+(?:[-+][\w.-]+)?)$/);
    if (m) {
      out.push({ id: `${m[1]}.${m[2]}`.toLowerCase(), version: m[3], source: "fs" });
    } else if (entry.name.includes(".")) {
      out.push({ id: entry.name.toLowerCase(), source: "fs" });
    }
  }
  return dedupe(out);
}

function dedupe(items: ExtensionInfo[]): ExtensionInfo[] {
  const map = new Map<string, ExtensionInfo>();
  for (const it of items) {
    const existing = map.get(it.id);
    if (!existing || (it.version && !existing.version)) map.set(it.id, it);
  }
  return [...map.values()].sort((a, b) => a.id.localeCompare(b.id));
}

export interface ExtensionSyncPlan {
  toInstall: string[];
  toRemove: string[];
  alreadyPresent: string[];
  skippedIncompatible: string[];
}

export interface PlanOptions {
  prune: boolean;
  targetPlatform?: PlatformId;
  includeIncompatible?: boolean;
}

export function planExtensionSync(source: ExtensionInfo[], target: ExtensionInfo[], options: PlanOptions): ExtensionSyncPlan {
  const sourceIds = new Set(source.map((e) => e.id));
  const targetIds = new Set(target.map((e) => e.id));

  const toInstall: string[] = [];
  const alreadyPresent: string[] = [];
  const skippedIncompatible: string[] = [];

  for (const id of sourceIds) {
    if (targetIds.has(id)) {
      alreadyPresent.push(id);
      continue;
    }
    if (
      !options.includeIncompatible &&
      options.targetPlatform &&
      isIncompatible(id, options.targetPlatform)
    ) {
      skippedIncompatible.push(id);
      continue;
    }
    toInstall.push(id);
  }
  const toRemove = options.prune ? [...targetIds].filter((id) => !sourceIds.has(id)) : [];

  return {
    toInstall: toInstall.sort(),
    toRemove: toRemove.sort(),
    alreadyPresent: alreadyPresent.sort(),
    skippedIncompatible: skippedIncompatible.sort(),
  };
}

export interface ApplyResult {
  installed: string[];
  removed: string[];
  failedInstall: { id: string; reason: string }[];
  failedRemove: { id: string; reason: string }[];
}

export function applyExtensionPlan(target: DetectedPlatform, plan: ExtensionSyncPlan, opts: { dryRun: boolean }): ApplyResult {
  const result: ApplyResult = { installed: [], removed: [], failedInstall: [], failedRemove: [] };

  if (opts.dryRun) {
    result.installed = [...plan.toInstall];
    result.removed = [...plan.toRemove];
    return result;
  }

  const bin = findCliBin(target);
  if (!bin) {
    const reason = `No CLI binary found for ${target.def.displayName} — install the editor's shell command from the command palette and retry.`;
    for (const id of plan.toInstall) result.failedInstall.push({ id, reason });
    for (const id of plan.toRemove) result.failedRemove.push({ id, reason });
    return result;
  }

  for (const id of plan.toInstall) {
    const r = spawnSync(bin, ["--install-extension", id, "--force"], { encoding: "utf8" });
    if (r.status === 0) result.installed.push(id);
    else result.failedInstall.push({ id, reason: (r.stderr || r.stdout || `exit ${r.status}`).trim() });
  }
  for (const id of plan.toRemove) {
    const r = spawnSync(bin, ["--uninstall-extension", id], { encoding: "utf8" });
    if (r.status === 0) result.removed.push(id);
    else result.failedRemove.push({ id, reason: (r.stderr || r.stdout || `exit ${r.status}`).trim() });
  }

  return result;
}

export function isCliAvailable(p: DetectedPlatform): boolean {
  return findCliBin(p) !== undefined;
}
