# vibe-sync

Sync settings, keybindings, snippets, and extensions across VSCode forks (Cursor, Windsurf, Antigravity, Trae, Void, VSCodium, Positron, plus VSCode itself).

Supported:

| ID                | Editor                |
| ----------------- | --------------------- |
| `vscode`          | Visual Studio Code    |
| `vscode-insiders` | VS Code Insiders      |
| `vscodium`        | VSCodium              |
| `cursor`          | Cursor                |
| `windsurf`        | Windsurf              |
| `trae`            | Trae                  |
| `void`            | Void                  |
| `antigravity`     | Google Antigravity    |
| `positron`        | Positron              |

Add more in `src/platforms.ts`.

## Install

```bash
npm install -g @stimmieuwu/vibe-sync
```

Or without installing:

```bash
npx @stimmieuwu/vibe-sync detect
```

From source:

```bash
pnpm install
pnpm dev -- detect --all
```

## Usage

```bash
vibe-sync detect

vibe-sync sync --from cursor --to vscode antigravity
vibe-sync sync --from cursor --all --dry-run
vibe-sync sync --from cursor --to vscode --merge

vibe-sync ext sync cursor windsurf --prune

vibe-sync export cursor --out ./my-profile
vibe-sync import ./my-profile windsurf
```

## Commands

| Command                                     | Description                                                          |
| ------------------------------------------- | -------------------------------------------------------------------- |
| `detect [--all] [--count-extensions]`       | List installed editors and their data paths.                         |
| `doctor`                                    | Check `PATH` bins and config directories.                            |
| `sync -f <src> [-t <dst...> \| --all]`      | Sync files and extensions. Flags: `--dry-run`, `--merge`, `--prune`, `--include`, `--exclude`, `--no-files`, `--no-extensions`. |
| `diff <a> <b>`                              | Show differences between two editors.                                |
| `export <platform> [-o <dir>]`              | Export a profile bundle.                                             |
| `import <bundle> <platform>`                | Import a profile bundle. Supports `--prune` and `--dry-run`.         |
| `extensions list <platform>`                | List installed extensions.                                           |
| `extensions sync <from> <to>`               | Sync extensions only.                                                |

Run `vibe-sync <cmd> --help` for flags.

## What gets synced

- `settings.json` (JSONC, comments preserved)
- `keybindings.json` (JSONC; merge mode dedupes entries)
- `tasks.json`
- `snippets/`
- Installed extensions (via `<editor> --install-extension`, with a filesystem fallback)

Not synced: `globalStorage/`, `workspaceStorage/`, `History/`, auth state. These are machine- and editor-specific.

## Safety

- Target files are backed up to `./vibe-sync-backups/<timestamp>/<platform>/` before being written. Disable with `--no-backup`.
- `--dry-run` skips all writes, including extension installs.
- Extensions are installed through the editor's own CLI, so signing and permissions are unchanged.

## Platform support

| OS      | Status   | Notes |
| ------- | -------- | ----- |
| Linux   | Tested   | Works on any distro that puts editor configs under `~/.config/`. |
| macOS   | Works    | Editor data resolved under `~/Library/Application Support/`. |
| Windows | Works    | Uses `%APPDATA%` and resolves editor `.cmd` shims via shell spawn. |

### Known limitations

- **Editor CLI on PATH is required for extension sync.** Most forks ship a "Shell Command: Install '<editor>' command in PATH" entry in their command palette - run it once, then `extension list` and `extension sync` work. Without it, vibe-sync can still read installed extensions via the filesystem scanner but cannot install or uninstall.
- **Marketplace fragmentation.** Each fork uses a different extension gallery. `anysphere.*` extensions only exist in Cursor, `google.*` in Antigravity, and Microsoft-only extensions like `ms-vscode.cpptools` only install in official VS Code. vibe-sync detects and skips known fork-exclusive extensions; pass `--include-incompatible` to override.
- **Default profile only.** VSCode and its forks support named profiles under `<userDataDir>/profiles/`. vibe-sync only touches the Default profile; if other profiles are present, you'll see a warning during sync.
- **Microsoft Store VSCode (Windows).** The Store version uses a sandboxed install path that vibe-sync does not resolve. The MSI/User installer of VSCode works fine.
- **Settings sync state.** vibe-sync does not interact with VSCode's built-in Settings Sync. If you have it enabled on the source, the synced files reflect the most recent local merge.
- **Secrets are not synced.** Tokens stored in the OS keychain (`globalStorage`, secret store) stay local to each install.

### PowerShell users

If you want to run a publish or scripted invocation that needs `.env` values, the bash one-liner `set -a; source .env; set +a` does not work in PowerShell. Use:

```powershell
Get-Content .env | ForEach-Object {
  if ($_ -match '^\s*([^#=]+)=(.*)$') { $env:($matches[1]) = $matches[2] }
}
```

## Adding a new fork

Add an entry to `PLATFORMS` in `src/platforms.ts` with the editor's product name and CLI binary. Every command picks it up.

## License

MIT
