import { detectAll } from "../platforms.js";
import { isCliAvailable, listExtensions } from "../sync/extensions.js";
import { c, log } from "../utils/log.js";

export interface DetectOptions {
  json?: boolean;
  showAll?: boolean;
  countExtensions?: boolean;
}

export function runDetect(opts: DetectOptions): void {
  const all = detectAll();
  const list = opts.showAll ? all : all.filter((p) => p.installed);

  if (opts.json) {
    const payload = list.map((p) => ({
      id: p.def.id,
      displayName: p.def.displayName,
      installed: p.installed,
      hasUserData: p.hasUserData,
      hasExtensions: p.hasExtensions,
      cliAvailable: isCliAvailable(p),
      paths: p.paths,
      extensionCount: opts.countExtensions ? listExtensions(p).length : undefined,
    }));
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  log.header("Detected vibe-coding platforms");
  if (list.length === 0) {
    log.warn("No VSCode-fork installations found.");
    return;
  }

  for (const p of list) {
    const tag = p.installed ? c.green("installed") : c.dim("missing");
    const cli = isCliAvailable(p) ? c.green("cli") : c.yellow("no-cli");
    const extCount = opts.countExtensions ? listExtensions(p).length : null;
    const extLabel = extCount !== null ? c.cyan(` ${extCount} ext`) : "";
    log.raw(
      `  ${c.bold(p.def.displayName)} ${c.dim(`(${p.def.id})`)}  [${tag}, ${cli}]${extLabel}`,
    );
    log.dim(`     user:  ${p.paths.userDataDir}`);
    log.dim(`     ext:   ${p.paths.extensionsDir}`);
  }
}
