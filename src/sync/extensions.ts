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

const IS_WIN = process.platform === "win32";

function spawnEditor(bin: string, args: string[]) {
  return spawnSync(bin, args, { encoding: "utf8", shell: IS_WIN });
}

function findCliBin(p: DetectedPlatform): string | undefined {
  for (const bin of p.def.cliBin) {
    const result = spawnSync(IS_WIN ? "where" : "which", [bin], { shell: IS_WIN });
    if (result.status === 0) return bin;
  }
  return undefined;
}

export function listExtensions(p: DetectedPlatform): ExtensionInfo[] {
  const bin = findCliBin(p);
  if (bin) {
    const res = spawnEditor(bin, ["--list-extensions", "--show-versions"]);
    if (res.status === 0) return parseCliList(res.stdout ?? "");
    log.warn(`${p.def.displayName}: '${bin} --list-extensions' exited ${res.status}, falling back to filesystem scan.`);
  }
  return scanExtensionsDir(p.paths.extensionsDir);
}

const EXT_ID_RE = /^[a-z0-9][a-z0-9-]*\.[a-z0-9][a-z0-9-]+$/;

function parseCliList(stdout: string): ExtensionInfo[] {
  const out: ExtensionInfo[] = [];
  for (const raw of stdout.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const at = line.lastIndexOf("@");
    const id = (at > 0 ? line.slice(0, at) : line).toLowerCase();
    if (!EXT_ID_RE.test(id)) continue;
    out.push({
      id,
      version: at > 0 ? line.slice(at + 1) : undefined,
      source: "cli",
    });
  }
  return dedupe(out);
}

function scanExtensionsDir(dir: string): ExtensionInfo[] {
  if (!existsSync(dir)) return [];

  const manifestPath = join(dir, "extensions.json");
  if (existsSync(manifestPath)) {
    try {
      const entries = JSON.parse(readFileSync(manifestPath, "utf8")) as Array<{
        identifier?: { id?: string };
        version?: string;
      }>;
      if (Array.isArray(entries)) {
        return dedupe(
          entries
            .map((e) => ({
              id: (e.identifier?.id ?? "").toLowerCase(),
              version: e.version,
              source: "fs" as const,
            }))
            .filter((e) => e.id),
        );
      }
    } catch {
      // fall through to folder walk
    }
  }

  const obsolete = readObsolete(dir);
  const out: ExtensionInfo[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
    if (obsolete.has(entry.name)) continue;
    const full = join(dir, entry.name);
    const pkgPath = join(full, "package.json");
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
          publisher?: string;
          name?: string;
          version?: string;
        };
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

function readObsolete(dir: string): Set<string> {
  const path = join(dir, ".obsolete");
  if (!existsSync(path)) return new Set();
  try {
    const raw = readFileSync(path, "utf8").trim();
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as Record<string, boolean> | string[];
    if (Array.isArray(parsed)) return new Set(parsed);
    return new Set(Object.keys(parsed).filter((k) => parsed[k]));
  } catch {
    return new Set();
  }
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

export interface ApplyOptions {
  dryRun: boolean;
  onStart?: (label: string) => void;
  onFinish?: (label: string, status: "ok" | "fail") => void;
}

export function applyExtensionPlan(target: DetectedPlatform, plan: ExtensionSyncPlan, opts: ApplyOptions): ApplyResult {
  const result: ApplyResult = { installed: [], removed: [], failedInstall: [], failedRemove: [] };

  if (opts.dryRun) {
    result.installed = [...plan.toInstall];
    result.removed = [...plan.toRemove];
    return result;
  }

  const bin = findCliBin(target);
  if (!bin) {
    const reason = `No CLI binary found for ${target.def.displayName}. Install the editor's shell command from the command palette and retry.`;
    for (const id of plan.toInstall) result.failedInstall.push({ id, reason });
    for (const id of plan.toRemove) result.failedRemove.push({ id, reason });
    return result;
  }

  for (const id of plan.toInstall) {
    opts.onStart?.(`installing ${id}`);
    const r = spawnEditor(bin, ["--install-extension", id, "--force"]);
    if (r.status === 0) {
      result.installed.push(id);
      opts.onFinish?.(`installed ${id}`, "ok");
    } else {
      result.failedInstall.push({ id, reason: (r.stderr || r.stdout || `exit ${r.status}`).trim() });
      opts.onFinish?.(`failed ${id}`, "fail");
    }
  }
  for (const id of plan.toRemove) {
    opts.onStart?.(`uninstalling ${id}`);
    const r = spawnEditor(bin, ["--uninstall-extension", id]);
    if (r.status === 0) {
      result.removed.push(id);
      opts.onFinish?.(`uninstalled ${id}`, "ok");
    } else {
      result.failedRemove.push({ id, reason: (r.stderr || r.stdout || `exit ${r.status}`).trim() });
      opts.onFinish?.(`failed to uninstall ${id}`, "fail");
    }
  }

  return result;
}

export function isCliAvailable(p: DetectedPlatform): boolean {
  return findCliBin(p) !== undefined;
}
