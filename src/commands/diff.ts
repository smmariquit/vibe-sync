import { join } from "node:path";

import { resolvePlatform, type DetectedPlatform } from "../platforms.js";
import { listExtensions } from "../sync/extensions.js";
import { listFilesRecursive, readFileIfExists } from "../utils/fs.js";
import { c, log } from "../utils/log.js";

export interface DiffOptions {
  json?: boolean;
}

function loadFile(p: DetectedPlatform, name: string): string | undefined {
  return readFileIfExists(join(p.paths.userDataDir, name));
}

function listSnippets(p: DetectedPlatform): string[] {
  return listFilesRecursive(join(p.paths.userDataDir, "snippets")).sort();
}

interface PlatformDiff {
  source: string;
  target: string;
  files: { name: string; sourceBytes?: number; targetBytes?: number; equal: boolean }[];
  snippets: { onlyInSource: string[]; onlyInTarget: string[] };
  extensions: { onlyInSource: string[]; onlyInTarget: string[] };
}

export function runDiff(a: string, b: string, opts: DiffOptions = {}): number {
  const A = resolvePlatform(a);
  const B = resolvePlatform(b);
  if (!A || !B) { log.error(`Unknown platform: ${!A ? a : b}`); return 1; }

  const fileNames = ["settings.json", "keybindings.json", "tasks.json"];
  const files = fileNames.map((name) => {
    const sa = loadFile(A, name);
    const sb = loadFile(B, name);
    return { name, sourceBytes: sa?.length, targetBytes: sb?.length, equal: sa === sb };
  });

  const aSnips = new Set(listSnippets(A));
  const bSnips = new Set(listSnippets(B));
  const snippets = {
    onlyInSource: [...aSnips].filter((s) => !bSnips.has(s)).sort(),
    onlyInTarget: [...bSnips].filter((s) => !aSnips.has(s)).sort(),
  };

  const aExt = new Set(listExtensions(A).map((e) => e.id));
  const bExt = new Set(listExtensions(B).map((e) => e.id));
  const extensions = {
    onlyInSource: [...aExt].filter((e) => !bExt.has(e)).sort(),
    onlyInTarget: [...bExt].filter((e) => !aExt.has(e)).sort(),
  };

  const result: PlatformDiff = { source: A.def.id, target: B.def.id, files, snippets, extensions };

  if (opts.json) { console.log(JSON.stringify(result, null, 2)); return 0; }

  log.header(`Diff: ${A.def.displayName} ↔ ${B.def.displayName}`);
  for (const f of files) {
    const tag = f.equal ? c.green("equal") : c.yellow("differs");
    log.raw(`  ${f.name.padEnd(20)} ${tag}  ${c.dim(`${f.sourceBytes ?? "absent"} vs ${f.targetBytes ?? "absent"} bytes`)}`);
  }

  log.raw("");
  log.raw(c.bold("Snippets"));
  if (!snippets.onlyInSource.length && !snippets.onlyInTarget.length) log.dim("  identical");
  for (const s of snippets.onlyInSource) log.raw(`  ${c.green("+")} ${s} ${c.dim(`(only in ${A.def.id})`)}`);
  for (const s of snippets.onlyInTarget) log.raw(`  ${c.red("-")} ${s} ${c.dim(`(only in ${B.def.id})`)}`);

  log.raw("");
  log.raw(c.bold("Extensions"));
  if (!extensions.onlyInSource.length && !extensions.onlyInTarget.length) log.dim("  identical");
  for (const e of extensions.onlyInSource) log.raw(`  ${c.green("+")} ${e} ${c.dim(`(only in ${A.def.id})`)}`);
  for (const e of extensions.onlyInTarget) log.raw(`  ${c.red("-")} ${e} ${c.dim(`(only in ${B.def.id})`)}`);

  return 0;
}
