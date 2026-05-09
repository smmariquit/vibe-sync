import { join } from "node:path";
import prompts from "prompts";

import {
  detectInstalled,
  resolvePlatform,
  type DetectedPlatform,
} from "../platforms.js";
import {
  applyExtensionPlan,
  listExtensions,
  planExtensionSync,
} from "../sync/extensions.js";
import {
  SYNC_KINDS,
  syncFiles,
  type SyncKind,
} from "../sync/files.js";
import { c, log } from "../utils/log.js";

export interface SyncOptions {
  from?: string;
  to?: string[];
  all?: boolean;
  include?: string[];
  exclude?: string[];
  extensions?: boolean;
  files?: boolean;
  prune?: boolean;
  merge?: boolean;
  dryRun?: boolean;
  yes?: boolean;
  noBackup?: boolean;
  backupDir?: string;
}

const DEFAULT_BACKUP = join(process.cwd(), "vibe-sync-backups");

function parseKinds(opts: SyncOptions): SyncKind[] {
  let kinds: SyncKind[] = [...SYNC_KINDS];
  if (opts.include && opts.include.length > 0) {
    kinds = opts.include.filter((k): k is SyncKind =>
      (SYNC_KINDS as string[]).includes(k),
    );
  }
  if (opts.exclude && opts.exclude.length > 0) {
    const ex = new Set(opts.exclude);
    kinds = kinds.filter((k) => !ex.has(k));
  }
  return kinds;
}

async function pickSource(): Promise<DetectedPlatform | undefined> {
  const installed = detectInstalled();
  if (installed.length === 0) return undefined;
  const { id } = await prompts({
    type: "select",
    name: "id",
    message: "Sync from which platform?",
    choices: installed.map((p) => ({
      title: `${p.def.displayName} ${c.dim(`(${p.def.id})`)}`,
      value: p.def.id,
    })),
  });
  return id ? resolvePlatform(id) : undefined;
}

async function pickTargets(
  source: DetectedPlatform,
): Promise<DetectedPlatform[]> {
  const installed = detectInstalled().filter(
    (p) => p.def.id !== source.def.id,
  );
  if (installed.length === 0) return [];
  const { ids } = await prompts({
    type: "multiselect",
    name: "ids",
    message: "Sync to which platforms?",
    instructions: false,
    hint: "space to toggle, enter to confirm",
    min: 1,
    choices: installed.map((p) => ({
      title: `${p.def.displayName} ${c.dim(`(${p.def.id})`)}`,
      value: p.def.id,
      selected: true,
    })),
  });
  if (!ids) return [];
  return (ids as string[])
    .map((id) => resolvePlatform(id))
    .filter((p): p is DetectedPlatform => Boolean(p));
}

export async function runSync(opts: SyncOptions): Promise<number> {
  const kinds = parseKinds(opts);
  const doFiles = opts.files !== false;
  const doExt = opts.extensions !== false;

  // Resolve source.
  let source: DetectedPlatform | undefined;
  if (opts.from) {
    source = resolvePlatform(opts.from);
    if (!source) {
      log.error(`Unknown source platform: ${opts.from}`);
      return 1;
    }
    if (!source.installed) {
      log.error(
        `Source platform "${source.def.displayName}" is not installed (${source.paths.userDataDir} not found).`,
      );
      return 1;
    }
  } else {
    source = await pickSource();
    if (!source) {
      log.error("No installed platforms detected.");
      return 1;
    }
  }

  // Resolve targets.
  let targets: DetectedPlatform[] = [];
  if (opts.all) {
    targets = detectInstalled().filter((p) => p.def.id !== source!.def.id);
  } else if (opts.to && opts.to.length > 0) {
    for (const t of opts.to) {
      const r = resolvePlatform(t);
      if (!r) {
        log.error(`Unknown target platform: ${t}`);
        return 1;
      }
      if (r.def.id === source.def.id) continue;
      targets.push(r);
    }
  } else {
    targets = await pickTargets(source);
  }

  if (targets.length === 0) {
    log.warn("No targets selected. Nothing to do.");
    return 0;
  }

  log.header(
    `Sync plan: ${source.def.displayName} → ${targets.map((t) => t.def.displayName).join(", ")}`,
  );
  log.info(`Files:      ${doFiles ? kinds.join(", ") : c.dim("disabled")}`);
  log.info(`Extensions: ${doExt ? "yes" : c.dim("disabled")}`);
  log.info(`Merge JSONC: ${opts.merge ? "yes" : "no (overwrite)"}`);
  log.info(`Prune extensions on target: ${opts.prune ? "yes" : "no"}`);
  log.info(`Dry run: ${opts.dryRun ? c.yellow("yes") : "no"}`);
  log.info(
    `Backups: ${opts.noBackup ? c.yellow("disabled") : opts.backupDir ?? DEFAULT_BACKUP}`,
  );

  if (!opts.yes && !opts.dryRun) {
    const { ok } = await prompts({
      type: "confirm",
      name: "ok",
      message: "Proceed?",
      initial: true,
    });
    if (!ok) {
      log.warn("Aborted.");
      return 0;
    }
  }

  let exitCode = 0;
  for (const target of targets) {
    log.step(`→ ${target.def.displayName}`);

    if (doFiles) {
      const fileResults = syncFiles(source, target, {
        kinds,
        merge: Boolean(opts.merge),
        dryRun: Boolean(opts.dryRun),
        noBackup: Boolean(opts.noBackup),
        backupRoot: opts.backupDir ?? DEFAULT_BACKUP,
      });
      if (fileResults.length === 0) {
        log.dim("   no source files to sync");
      } else {
        for (const r of fileResults) {
          const verb =
            r.action === "wrote"
              ? c.green("wrote   ")
              : r.action === "merged"
                ? c.green("merged  ")
                : r.action === "would-write"
                  ? c.yellow("DRY     ")
                  : r.action === "would-merge"
                    ? c.yellow("DRY-MRG ")
                    : c.dim("skipped ");
          const detail =
            r.kind === "snippets"
              ? `${r.files ?? 0} files`
              : `${r.bytes ?? 0} bytes`;
          log.raw(`   ${verb} ${r.kind.padEnd(11)} ${c.dim(detail)}`);
        }
      }
    }

    if (doExt) {
      const sourceExt = listExtensions(source);
      const targetExt = listExtensions(target);
      const plan = planExtensionSync(sourceExt, targetExt, {
        prune: Boolean(opts.prune),
      });
      log.raw(
        `   extensions: ${c.green(`+${plan.toInstall.length}`)} ${c.red(`-${plan.toRemove.length}`)} ${c.dim(`(=${plan.alreadyPresent.length})`)}`,
      );
      if (plan.toInstall.length > 0) {
        for (const id of plan.toInstall) log.dim(`     + ${id}`);
      }
      if (plan.toRemove.length > 0) {
        for (const id of plan.toRemove) log.dim(`     - ${id}`);
      }
      const applied = applyExtensionPlan(target, plan, {
        dryRun: Boolean(opts.dryRun),
      });
      if (applied.failedInstall.length > 0 || applied.failedRemove.length > 0) {
        exitCode = 2;
        for (const f of applied.failedInstall)
          log.warn(`     install failed: ${f.id} — ${f.reason}`);
        for (const f of applied.failedRemove)
          log.warn(`     uninstall failed: ${f.id} — ${f.reason}`);
      }
    }
  }

  log.success("Done.");
  return exitCode;
}
