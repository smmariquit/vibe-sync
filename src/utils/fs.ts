import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

export function ensureDir(dir: string): void {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

export function readFileIfExists(p: string): string | undefined {
  try {
    if (!existsSync(p)) return undefined;
    return readFileSync(p, "utf8");
  } catch {
    return undefined;
  }
}

export function writeFileSafe(p: string, content: string): void {
  ensureDir(dirname(p));
  writeFileSync(p, content, "utf8");
}

export function copyFile(src: string, dest: string): void {
  ensureDir(dirname(dest));
  cpSync(src, dest, { force: true });
}

export function copyDir(src: string, dest: string, overwrite = true): number {
  if (!existsSync(src)) return 0;
  ensureDir(dest);
  let count = 0;
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const sp = join(src, entry.name);
    const dp = join(dest, entry.name);
    if (entry.isDirectory()) {
      count += copyDir(sp, dp, overwrite);
    } else if (entry.isFile()) {
      if (!overwrite && existsSync(dp)) continue;
      cpSync(sp, dp, { force: overwrite });
      count++;
    }
  }
  return count;
}

export function listFilesRecursive(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  const walk = (cur: string) => {
    for (const entry of readdirSync(cur, { withFileTypes: true })) {
      const full = join(cur, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) out.push(full);
    }
  };
  walk(dir);
  return out.map((f) => relative(dir, f));
}

export function isFile(p: string): boolean {
  try {
    return existsSync(p) && statSync(p).isFile();
  } catch {
    return false;
  }
}

export function isDir(p: string): boolean {
  try {
    return existsSync(p) && statSync(p).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Snapshot a path under <backupRoot>/<isoTimestamp>/<label>/...
 * Returns the absolute backup path that was created (or undefined when nothing
 * existed to back up).
 */
export function backupPath(
  src: string,
  backupRoot: string,
  label: string,
): string | undefined {
  if (!existsSync(src)) return undefined;
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const dest = resolve(backupRoot, ts, label);
  ensureDir(dirname(dest));
  cpSync(src, dest, { recursive: true, force: true });
  return dest;
}

export function removeIfExists(p: string): void {
  if (existsSync(p)) rmSync(p, { recursive: true, force: true });
}
