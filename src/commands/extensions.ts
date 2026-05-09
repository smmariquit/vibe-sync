import { resolvePlatform } from "../platforms.js";
import { applyExtensionPlan, isCliAvailable, listExtensions, planExtensionSync } from "../sync/extensions.js";
import { c, log } from "../utils/log.js";
import { Progress } from "../utils/progress.js";

export interface ExtListOptions {
  json?: boolean;
}

export function runExtList(platformId: string, opts: ExtListOptions): number {
  const p = resolvePlatform(platformId);
  if (!p) { log.error(`Unknown platform: ${platformId}`); return 1; }

  const list = listExtensions(p);
  if (opts.json) { console.log(JSON.stringify(list, null, 2)); return 0; }

  log.header(`${p.def.displayName} — ${list.length} extensions`);
  if (!isCliAvailable(p)) log.warn("No CLI binary on PATH; results came from filesystem scan.");
  for (const e of list) {
    log.raw(`  ${e.id}${e.version ? c.dim(` @ ${e.version}`) : ""}`);
  }
  return 0;
}

export interface ExtSyncOptions {
  prune?: boolean;
  dryRun?: boolean;
  includeIncompatible?: boolean;
}

export function runExtSync(fromId: string, toId: string, opts: ExtSyncOptions): number {
  const from = resolvePlatform(fromId);
  const to = resolvePlatform(toId);
  if (!from || !to) { log.error(`Unknown platform: ${!from ? fromId : toId}`); return 1; }

  const plan = planExtensionSync(listExtensions(from), listExtensions(to), {
    prune: Boolean(opts.prune),
    targetPlatform: to.def.id,
    includeIncompatible: Boolean(opts.includeIncompatible),
  });
  const skipBadge = plan.skippedIncompatible.length ? ` / ~${plan.skippedIncompatible.length}` : "";
  log.header(`Extensions: ${from.def.displayName} → ${to.def.displayName}  (+${plan.toInstall.length} / -${plan.toRemove.length}${skipBadge})`);
  for (const id of plan.toInstall) log.raw(`  ${c.green("+")} ${id}`);
  for (const id of plan.toRemove) log.raw(`  ${c.red("-")} ${id}`);
  for (const id of plan.skippedIncompatible)
    log.raw(`  ${c.yellow("~")} ${id} ${c.dim("(skipped: not available on this fork)")}`);

  const totalOps = plan.toInstall.length + plan.toRemove.length;
  const progress = totalOps > 0 && !opts.dryRun
    ? new Progress({ total: totalOps, prefix: "  " })
    : undefined;
  const applied = applyExtensionPlan(to, plan, {
    dryRun: Boolean(opts.dryRun),
    onStart: (label) => progress?.start(label),
    onFinish: (label, status) => progress?.finish(label, status),
  });
  progress?.done();
  if (applied.failedInstall.length || applied.failedRemove.length) {
    for (const f of applied.failedInstall) log.warn(`install failed: ${f.id} — ${f.reason}`);
    for (const f of applied.failedRemove) log.warn(`uninstall failed: ${f.id} — ${f.reason}`);
    return 2;
  }
  log.success("Extensions sync complete.");
  return 0;
}
