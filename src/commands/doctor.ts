import { detectAll } from "../platforms.js";
import { isCliAvailable, listExtensions } from "../sync/extensions.js";
import { c, log } from "../utils/log.js";

export function runDoctor(): number {
  log.header("vibe-sync doctor");
  const all = detectAll();
  const installed = all.filter((p) => p.installed);

  log.info(`Detected ${installed.length}/${all.length} known platforms installed.`);

  let warnings = 0;
  for (const p of installed) {
    const cliOk = isCliAvailable(p);
    const exts = listExtensions(p);
    log.raw(
      `  ${c.bold(p.def.displayName)} ${c.dim(`(${p.def.id})`)}: ${cliOk ? c.green("cli OK") : c.yellow("cli missing")}, ${exts.length} extensions`,
    );
    if (!cliOk) {
      warnings++;
      log.dim(`     → run "Install '${p.def.cliBin[0]}' command in PATH" from the command palette.`);
    }
    if (!p.hasUserData) log.dim(`     → user data dir missing: ${p.paths.userDataDir}`);
    if (!p.hasExtensions) log.dim(`     → extensions dir missing: ${p.paths.extensionsDir}`);
  }

  if (warnings === 0) log.success("All installed platforms look ready for syncing.");
  else log.warn(`${warnings} warning(s). See messages above.`);
  return 0;
}
