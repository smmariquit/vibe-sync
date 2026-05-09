import { Command, Option } from "commander";

import { runDetect } from "./commands/detect.js";
import { runDiff } from "./commands/diff.js";
import { runDoctor } from "./commands/doctor.js";
import { runExtList, runExtSync } from "./commands/extensions.js";
import { runExport, runImport } from "./commands/exportImport.js";
import { runSync } from "./commands/sync.js";
import { PLATFORMS } from "./platforms.js";
import { log } from "./utils/log.js";

const PLATFORM_IDS = PLATFORMS.map((p) => p.id);

function makeProgram(): Command {
  const program = new Command();
  program
    .name("vibe-sync")
    .description(
      "Sync settings, keybindings, snippets, and extensions across VSCode-fork 'vibe coding' editors (Cursor, Windsurf, Trae, Antigravity, Void, VSCodium, VSCode).",
    )
    .version("0.1.0")
    .showHelpAfterError();

  program
    .command("detect")
    .description("List installed VSCode-fork editors and where they live.")
    .option("--all", "Include known editors that are not installed.", false)
    .option("-c, --count-extensions", "Also count installed extensions.", false)
    .option("--json", "Emit JSON instead of a pretty table.", false)
    .action((opts) =>
      runDetect({
        showAll: opts.all,
        countExtensions: opts.countExtensions,
        json: opts.json,
      }),
    );

  program
    .command("doctor")
    .description("Quick health check: PATH bins, paths, extension counts.")
    .action(() => process.exit(runDoctor()));

  const sync = program
    .command("sync")
    .description("Sync from one platform to one or more targets.")
    .addOption(
      new Option("-f, --from <platform>", "Source platform").choices(
        PLATFORM_IDS,
      ),
    )
    .option(
      "-t, --to <platforms...>",
      "Target platforms (one or more). Mutually exclusive with --all.",
    )
    .option("-a, --all", "Sync to every other detected platform.", false)
    .option(
      "-i, --include <kinds...>",
      "Limit which file kinds to sync (settings,keybindings,tasks,snippets).",
    )
    .option("-x, --exclude <kinds...>", "Exclude specific file kinds.")
    .option("--no-files", "Skip files; only sync extensions.")
    .option("--no-extensions", "Skip extensions; only sync files.")
    .option("--prune", "Uninstall extensions on target that are not in source.", false)
    .option(
      "--merge",
      "Deep-merge JSONC settings instead of overwriting (preserves target-only keys).",
      false,
    )
    .option("-n, --dry-run", "Show what would change without writing.", false)
    .option("-y, --yes", "Skip the confirmation prompt.", false)
    .option("--no-backup", "Do not snapshot target files before writing.")
    .option(
      "--backup-dir <path>",
      "Directory to write timestamped backups under (default: ./vibe-sync-backups)",
    )
    .action(async (opts) => {
      const code = await runSync({
        from: opts.from,
        to: opts.to,
        all: opts.all,
        include: opts.include,
        exclude: opts.exclude,
        files: opts.files,
        extensions: opts.extensions,
        prune: opts.prune,
        merge: opts.merge,
        dryRun: opts.dryRun,
        yes: opts.yes,
        noBackup: !opts.backup,
        backupDir: opts.backupDir,
      });
      process.exit(code);
    });
  void sync;

  program
    .command("diff <a> <b>")
    .description("Show what differs between two platforms.")
    .option("--json", "Emit JSON.", false)
    .action((a: string, b: string, opts) =>
      process.exit(runDiff(a, b, { json: opts.json })),
    );

  program
    .command("export <platform>")
    .description("Export a platform's profile (files + extension list) to a folder.")
    .option(
      "-o, --out <dir>",
      "Output directory (default: ./vibe-sync-profile-<platform>)",
    )
    .option("--no-extensions", "Skip recording extensions in the profile.")
    .action((platform: string, opts) =>
      process.exit(
        runExport(platform, { out: opts.out, noExtensions: !opts.extensions }),
      ),
    );

  program
    .command("import <bundle> <platform>")
    .description("Import a previously exported profile bundle into <platform>.")
    .option("--prune", "Remove extensions on target that aren't in the bundle.", false)
    .option("--no-extensions", "Skip installing extensions from the bundle.")
    .option("-n, --dry-run", "Show what would change without writing.", false)
    .action((bundle: string, platform: string, opts) =>
      process.exit(
        runImport(bundle, platform, {
          prune: opts.prune,
          noExtensions: !opts.extensions,
          dryRun: opts.dryRun,
        }),
      ),
    );

  const ext = program
    .command("extensions")
    .alias("ext")
    .description("Inspect or sync extensions only.");
  ext
    .command("list <platform>")
    .description("List installed extensions for a platform.")
    .option("--json", "Emit JSON.", false)
    .action((platform: string, opts) =>
      process.exit(runExtList(platform, { json: opts.json })),
    );
  ext
    .command("sync <from> <to>")
    .description("Sync extensions from <from> to <to>.")
    .option("--prune", "Remove extensions on <to> that aren't in <from>.", false)
    .option("-n, --dry-run", "Show what would change without writing.", false)
    .action((from: string, to: string, opts) =>
      process.exit(
        runExtSync(from, to, { prune: opts.prune, dryRun: opts.dryRun }),
      ),
    );

  return program;
}

async function main(): Promise<void> {
  const program = makeProgram();
  try {
    await program.parseAsync(process.argv);
  } catch (err) {
    log.error((err as Error).message);
    process.exit(1);
  }
}

main();
