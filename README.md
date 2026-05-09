# vibe-sync

A small, fast CLI that keeps **settings, keybindings, snippets, and extensions** in lockstep across VSCode-fork "vibe coding" editors.

Supports out of the box:

| ID                | Editor                |
| ----------------- | --------------------- |
| `vscode`          | Visual Studio Code    |
| `vscode-insiders` | VS Code Insiders      |
| `vscodium`        | VSCodium              |
| `cursor`          | Cursor                |
| `windsurf`        | Windsurf (Codeium)    |
| `trae`            | Trae                  |
| `void`            | Void                  |
| `antigravity`     | Google Antigravity    |
| `positron`        | Positron              |

Adding more is a one-line patch in `src/platforms.ts`.

---

## Why

Every fork stores user data under its own product name (`~/.config/Cursor/User`, `~/.config/Code/User`, `~/.config/Antigravity/User`, …), and extensions in a parallel `~/.<editor>/extensions` tree. Their on-disk layouts are identical to upstream VS Code's, but nothing in the box keeps them in sync. `vibe-sync` automates the boring 90% — copy the JSONC config files, copy the snippets folder, and run `<editor> --install-extension <id>` for every missing extension on each target.

## Install

```bash
# from a checkout
pnpm install        # or: npm install / bun install
pnpm build
npm link            # exposes `vibe-sync` and `vsync` on your PATH
```

Or run it directly during development:

```bash
pnpm dev -- detect --all
```

## Quickstart

```bash
# What's on this machine?
vibe-sync detect

# Make Cursor + Antigravity look exactly like your VS Code setup
vibe-sync sync --from vscode --to cursor antigravity

# Sync to every other detected fork, with a confirmation prompt
vibe-sync sync --from cursor --all

# Preview only (no writes, no installs)
vibe-sync sync --from cursor --all --dry-run

# Merge instead of overwrite (preserve target-only settings keys)
vibe-sync sync --from cursor --to vscode --merge

# Move just extensions
vibe-sync ext sync cursor windsurf --prune

# Snapshot a profile to disk and apply it on another machine
vibe-sync export cursor --out ./my-profile
# … later, on another box …
vibe-sync import ./my-profile windsurf
```

## Commands

| Command                                     | What it does                                                          |
| ------------------------------------------- | --------------------------------------------------------------------- |
| `detect [--all] [--count-extensions]`       | Lists installed editors and their data paths.                         |
| `doctor`                                    | Health check: are CLI bins on `PATH`? are dirs present?               |
| `sync -f <src> [-t <dst…> | --all]`         | The main event. Sync files + extensions. Supports `--dry-run`, `--merge`, `--prune`, `--include settings keybindings tasks snippets`, `--exclude …`, `--no-files`, `--no-extensions`. |
| `diff <a> <b>`                              | Show what differs between two installs (files, snippets, extensions). |
| `export <platform> [-o <dir>]`              | Save a portable profile bundle.                                       |
| `import <bundle> <platform>`                | Apply a profile bundle. `--prune --dry-run` supported.                |
| `extensions list <platform>`                | List installed extensions (CLI first, filesystem fallback).           |
| `extensions sync <from> <to>`               | Sync just the extension set.                                          |

Run `vibe-sync <cmd> --help` for the full flag list.

## What gets synced

- `settings.json` (JSONC, comments preserved)
- `keybindings.json` (JSONC array; merge mode = dedupe-concat)
- `tasks.json`
- `snippets/` (every file inside, recursively)
- Extensions (via the editor's own `--list-extensions` / `--install-extension` CLI; falls back to scanning the extensions directory when the CLI isn't on `PATH`)

`globalStorage/`, `workspaceStorage/`, `History/`, secrets, and the editor's UI state are intentionally **not** synced — they're machine-local and editor-specific, and copying them across forks is the fast way to corrupt your install.

## Safety

- Every target file is snapshotted to `./vibe-sync-backups/<iso-timestamp>/<platform>/...` before being overwritten (turn off with `--no-backup`).
- `--dry-run` is honored everywhere, including extension installs.
- The installer always uses the editor's own CLI (`cursor --install-extension`, `windsurf --install-extension`, …), so signature checks and gallery permissions stay intact.

## Adding a new fork

Open `src/platforms.ts`, add an entry to `PLATFORMS` with the editor's product name (used for the user data directory) and its CLI binary name. That's it — every command picks it up automatically.

## License

MIT.
