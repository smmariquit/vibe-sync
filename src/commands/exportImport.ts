import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { resolvePlatform, type DetectedPlatform } from "../platforms.js";
import {
  applyExtensionPlan,
  listExtensions,
  planExtensionSync,
  type ExtensionInfo,
} from "../sync/extensions.js";
import { copyAny } from "../sync/files.js";
import { ensureDir, writeFileSafe } from "../utils/fs.js";
import { c, log } from "../utils/log.js";

const PROFILE_FILES = ["settings.json", "keybindings.json", "tasks.json"];

interface ProfileMeta {
  vibeSync: { version: 1 };
  source: { platform: string; displayName: string };
  exportedAt: string;
  extensions: ExtensionInfo[];
}

export interface ExportOptions {
  out?: string;
  noExtensions?: boolean;
}

export function runExport(platformId: string, opts: ExportOptions): number {
  const p = resolvePlatform(platformId);
  if (!p) {
    log.error(`Unknown platform: ${platformId}`);
    return 1;
  }

  const target = resolve(opts.out ?? `./vibe-sync-profile-${p.def.id}`);
  ensureDir(target);

  log.header(`Exporting ${p.def.displayName} → ${target}`);

  for (const f of PROFILE_FILES) {
    const src = join(p.paths.userDataDir, f);
    if (existsSync(src)) {
      copyAny(src, join(target, f));
      log.success(`saved ${f}`);
    }
  }
  const snippetsSrc = join(p.paths.userDataDir, "snippets");
  if (existsSync(snippetsSrc)) {
    copyAny(snippetsSrc, join(target, "snippets"));
    log.success("saved snippets/");
  }

  const meta: ProfileMeta = {
    vibeSync: { version: 1 },
    source: { platform: p.def.id, displayName: p.def.displayName },
    exportedAt: new Date().toISOString(),
    extensions: opts.noExtensions ? [] : listExtensions(p),
  };
  writeFileSafe(join(target, "vibe-sync.json"), JSON.stringify(meta, null, 2));
  log.success(`saved vibe-sync.json (${meta.extensions.length} extensions tracked)`);

  return 0;
}

export interface ImportOptions {
  prune?: boolean;
  noExtensions?: boolean;
  dryRun?: boolean;
}

export function runImport(
  bundlePath: string,
  platformId: string,
  opts: ImportOptions,
): number {
  const target = resolvePlatform(platformId);
  if (!target) {
    log.error(`Unknown platform: ${platformId}`);
    return 1;
  }
  const bundle = resolve(bundlePath);
  if (!existsSync(bundle)) {
    log.error(`Bundle not found: ${bundle}`);
    return 1;
  }
  const metaPath = join(bundle, "vibe-sync.json");
  if (!existsSync(metaPath)) {
    log.error(`Missing vibe-sync.json in bundle: ${bundle}`);
    return 1;
  }

  const meta = JSON.parse(readFileSync(metaPath, "utf8")) as ProfileMeta;
  log.header(
    `Importing ${meta.source.displayName} bundle → ${target.def.displayName}`,
  );

  ensureDir(target.paths.userDataDir);
  for (const f of PROFILE_FILES) {
    const src = join(bundle, f);
    if (existsSync(src)) {
      if (opts.dryRun) {
        log.raw(`  ${c.yellow("DRY")} would write ${f}`);
      } else {
        copyAny(src, join(target.paths.userDataDir, f));
        log.success(`wrote ${f}`);
      }
    }
  }
  const snippetsSrc = join(bundle, "snippets");
  if (existsSync(snippetsSrc)) {
    if (opts.dryRun) {
      log.raw(`  ${c.yellow("DRY")} would write snippets/`);
    } else {
      copyAny(snippetsSrc, join(target.paths.userDataDir, "snippets"));
      log.success("wrote snippets/");
    }
  }

  if (!opts.noExtensions && meta.extensions && meta.extensions.length > 0) {
    const targetExt = listExtensions(target);
    const plan = planExtensionSync(meta.extensions, targetExt, {
      prune: Boolean(opts.prune),
    });
    log.raw(
      `extensions: ${c.green(`+${plan.toInstall.length}`)} ${c.red(`-${plan.toRemove.length}`)} ${c.dim(`(=${plan.alreadyPresent.length})`)}`,
    );
    const applied = applyExtensionPlan(target, plan, {
      dryRun: Boolean(opts.dryRun),
    });
    if (applied.failedInstall.length || applied.failedRemove.length) {
      for (const f of applied.failedInstall)
        log.warn(`install failed: ${f.id} — ${f.reason}`);
      for (const f of applied.failedRemove)
        log.warn(`uninstall failed: ${f.id} — ${f.reason}`);
      return 2;
    }
  }

  log.success("Import complete.");
  return 0;
}
