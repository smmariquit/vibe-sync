import { existsSync, statSync } from "node:fs";
import { homedir, platform as osPlatform } from "node:os";
import { join } from "node:path";

export type PlatformId =
  | "vscode"
  | "vscode-insiders"
  | "vscodium"
  | "cursor"
  | "windsurf"
  | "trae"
  | "void"
  | "antigravity"
  | "positron";

export interface PlatformPaths {
  userDataDir: string;
  extensionsDir: string;
}

export interface PlatformDef {
  id: PlatformId;
  displayName: string;
  cliBin: string[];
  linux: PlatformPaths;
  darwin: PlatformPaths;
  win32: PlatformPaths;
}

const HOME = homedir();
const APPDATA = process.env.APPDATA ?? join(HOME, "AppData", "Roaming");

function macUser(name: string): string {
  return join(HOME, "Library", "Application Support", name, "User");
}

export const PLATFORMS: PlatformDef[] = [
  {
    id: "vscode",
    displayName: "Visual Studio Code",
    cliBin: ["code"],
    linux: {
      userDataDir: join(HOME, ".config", "Code", "User"),
      extensionsDir: join(HOME, ".vscode", "extensions"),
    },
    darwin: {
      userDataDir: macUser("Code"),
      extensionsDir: join(HOME, ".vscode", "extensions"),
    },
    win32: {
      userDataDir: join(APPDATA, "Code", "User"),
      extensionsDir: join(HOME, ".vscode", "extensions"),
    },
  },
  {
    id: "vscode-insiders",
    displayName: "VS Code Insiders",
    cliBin: ["code-insiders"],
    linux: {
      userDataDir: join(HOME, ".config", "Code - Insiders", "User"),
      extensionsDir: join(HOME, ".vscode-insiders", "extensions"),
    },
    darwin: {
      userDataDir: macUser("Code - Insiders"),
      extensionsDir: join(HOME, ".vscode-insiders", "extensions"),
    },
    win32: {
      userDataDir: join(APPDATA, "Code - Insiders", "User"),
      extensionsDir: join(HOME, ".vscode-insiders", "extensions"),
    },
  },
  {
    id: "vscodium",
    displayName: "VSCodium",
    cliBin: ["codium", "vscodium"],
    linux: {
      userDataDir: join(HOME, ".config", "VSCodium", "User"),
      extensionsDir: join(HOME, ".vscode-oss", "extensions"),
    },
    darwin: {
      userDataDir: macUser("VSCodium"),
      extensionsDir: join(HOME, ".vscode-oss", "extensions"),
    },
    win32: {
      userDataDir: join(APPDATA, "VSCodium", "User"),
      extensionsDir: join(HOME, ".vscode-oss", "extensions"),
    },
  },
  {
    id: "cursor",
    displayName: "Cursor",
    cliBin: ["cursor"],
    linux: {
      userDataDir: join(HOME, ".config", "Cursor", "User"),
      extensionsDir: join(HOME, ".cursor", "extensions"),
    },
    darwin: {
      userDataDir: macUser("Cursor"),
      extensionsDir: join(HOME, ".cursor", "extensions"),
    },
    win32: {
      userDataDir: join(APPDATA, "Cursor", "User"),
      extensionsDir: join(HOME, ".cursor", "extensions"),
    },
  },
  {
    id: "windsurf",
    displayName: "Windsurf",
    cliBin: ["windsurf"],
    linux: {
      userDataDir: join(HOME, ".config", "Windsurf", "User"),
      extensionsDir: join(HOME, ".windsurf", "extensions"),
    },
    darwin: {
      userDataDir: macUser("Windsurf"),
      extensionsDir: join(HOME, ".windsurf", "extensions"),
    },
    win32: {
      userDataDir: join(APPDATA, "Windsurf", "User"),
      extensionsDir: join(HOME, ".windsurf", "extensions"),
    },
  },
  {
    id: "trae",
    displayName: "Trae",
    cliBin: ["trae"],
    linux: {
      userDataDir: join(HOME, ".config", "Trae", "User"),
      extensionsDir: join(HOME, ".trae", "extensions"),
    },
    darwin: {
      userDataDir: macUser("Trae"),
      extensionsDir: join(HOME, ".trae", "extensions"),
    },
    win32: {
      userDataDir: join(APPDATA, "Trae", "User"),
      extensionsDir: join(HOME, ".trae", "extensions"),
    },
  },
  {
    id: "void",
    displayName: "Void",
    cliBin: ["void"],
    linux: {
      userDataDir: join(HOME, ".config", "Void", "User"),
      extensionsDir: join(HOME, ".void", "extensions"),
    },
    darwin: {
      userDataDir: macUser("Void"),
      extensionsDir: join(HOME, ".void", "extensions"),
    },
    win32: {
      userDataDir: join(APPDATA, "Void", "User"),
      extensionsDir: join(HOME, ".void", "extensions"),
    },
  },
  {
    id: "antigravity",
    displayName: "Google Antigravity",
    cliBin: ["antigravity"],
    linux: {
      userDataDir: join(HOME, ".config", "Antigravity", "User"),
      extensionsDir: join(HOME, ".antigravity", "extensions"),
    },
    darwin: {
      userDataDir: macUser("Antigravity"),
      extensionsDir: join(HOME, ".antigravity", "extensions"),
    },
    win32: {
      userDataDir: join(APPDATA, "Antigravity", "User"),
      extensionsDir: join(HOME, ".antigravity", "extensions"),
    },
  },
  {
    id: "positron",
    displayName: "Positron",
    cliBin: ["positron"],
    linux: {
      userDataDir: join(HOME, ".config", "Positron", "User"),
      extensionsDir: join(HOME, ".positron", "extensions"),
    },
    darwin: {
      userDataDir: macUser("Positron"),
      extensionsDir: join(HOME, ".positron", "extensions"),
    },
    win32: {
      userDataDir: join(APPDATA, "Positron", "User"),
      extensionsDir: join(HOME, ".positron", "extensions"),
    },
  },
];

export interface DetectedPlatform {
  def: PlatformDef;
  paths: PlatformPaths;
  installed: boolean;
  hasUserData: boolean;
  hasExtensions: boolean;
}

function pathsFor(def: PlatformDef): PlatformPaths {
  const os = osPlatform();
  if (os === "darwin") return def.darwin;
  if (os === "win32") return def.win32;
  return def.linux;
}

function isDir(p: string): boolean {
  try {
    return existsSync(p) && statSync(p).isDirectory();
  } catch {
    return false;
  }
}

export function getPlatform(id: PlatformId): DetectedPlatform | undefined {
  const def = PLATFORMS.find((p) => p.id === id);
  if (!def) return undefined;
  const paths = pathsFor(def);
  const hasUserData = isDir(paths.userDataDir);
  const hasExtensions = isDir(paths.extensionsDir);
  return { def, paths, installed: hasUserData || hasExtensions, hasUserData, hasExtensions };
}

export function detectAll(): DetectedPlatform[] {
  return PLATFORMS.map((def) => {
    const paths = pathsFor(def);
    const hasUserData = isDir(paths.userDataDir);
    const hasExtensions = isDir(paths.extensionsDir);
    return { def, paths, installed: hasUserData || hasExtensions, hasUserData, hasExtensions };
  });
}

export function detectInstalled(): DetectedPlatform[] {
  return detectAll().filter((p) => p.installed);
}

export function resolvePlatform(idOrAlias: string): DetectedPlatform | undefined {
  const norm = idOrAlias.trim().toLowerCase();
  const direct = PLATFORMS.find(
    (p) => p.id === norm || p.displayName.toLowerCase() === norm,
  );
  if (direct) return getPlatform(direct.id);
  const aliases: Record<string, PlatformId> = {
    code: "vscode",
    vsc: "vscode",
    insiders: "vscode-insiders",
    "code-insiders": "vscode-insiders",
    codium: "vscodium",
    oss: "vscodium",
    ag: "antigravity",
    google: "antigravity",
  };
  const alias = aliases[norm];
  return alias ? getPlatform(alias) : undefined;
}

export const EXCLUSIVE_PUBLISHERS: Record<PlatformId, string[]> = {
  cursor: ["anysphere."],
  vscode: ["ms-vscode.cpptools", "ms-vscode.remote-", "ms-vscode-remote.", "ms-vsliveshare."],
  "vscode-insiders": ["ms-vscode.cpptools", "ms-vscode.remote-", "ms-vscode-remote.", "ms-vsliveshare."],
  antigravity: ["google.", "googlecloudtools."],
  windsurf: ["codeium.", "windsurf."],
  trae: ["trae."],
  void: ["void."],
  vscodium: [],
  positron: ["posit."],
};

export function isIncompatible(extensionId: string, target: PlatformId): boolean {
  for (const [owner, prefixes] of Object.entries(EXCLUSIVE_PUBLISHERS) as [PlatformId, string[]][]) {
    if (owner === target) continue;
    if (prefixes.some((p) => extensionId.startsWith(p))) return true;
  }
  return false;
}
