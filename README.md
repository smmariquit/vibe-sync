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

## Adding a new fork

Add an entry to `PLATFORMS` in `src/platforms.ts` with the editor's product name and CLI binary. Every command picks it up.

## License

MIT
