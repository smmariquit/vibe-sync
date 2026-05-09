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
    .description("Sync settings, keybindings, snippets, and extensions across VSCode-fork editors.")
    .version("0.1.0")
    .showHelpAfterError();

  program
    .command("detect")
    .description("List installed VSCode-fork editors and where they live.")
    .option("--all", "Include editors that aren't installed.", false)
    .option("-c, --count-extensions", "Also count installed extensions.", false)
    .option("--json", "Emit JSON.", false)
    .action((opts) => runDetect({ showAll: opts.all, countExtensions: opts.countExtensions, json: opts.json }));

  program
    .command("doctor")
    .description("Check PATH bins, paths, and extension counts.")
    .action(() => process.exit(runDoctor()));

  program
    .command("sync")
    .description("Sync from one platform to one or more targets.")
    .addOption(new Option("-f, --from <platform>", "Source platform").choices(PLATFORM_IDS))
    .option("-t, --to <platforms...>", "Target platforms.")
    .option("-a, --all", "Sync to every other detected platform.", false)
    .option("-i, --include <kinds...>", "Only sync these kinds (settings, keybindings, tasks, snippets).")
    .option("-x, --exclude <kinds...>", "Skip these kinds.")
    .option("--no-files", "Skip files, only sync extensions.")
    .option("--no-extensions", "Skip extensions, only sync files.")
    .option("--prune", "Uninstall extensions on target that aren't in source.", false)
    .option("--merge", "Deep-merge settings instead of overwriting.", false)
    .option("-n, --dry-run", "Show what would change without writing.", false)
    .option("-y, --yes", "Skip the confirmation prompt.", false)
    .option("--no-backup", "Don't snapshot target files before writing.")
    .option("--backup-dir <path>", "Directory for timestamped backups (default: ./vibe-sync-backups).")
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

  program
    .command("diff <a> <b>")
    .description("Show what differs between two platforms.")
    .option("--json", "Emit JSON.", false)
    .action((a: string, b: string, opts) => process.exit(runDiff(a, b, { json: opts.json })));

  program
    .command("export <platform>")
    .description("Export a platform's profile to a folder.")
    .option("-o, --out <dir>", "Output directory (default: ./vibe-sync-profile-<platform>).")
    .option("--no-extensions", "Don't record extensions in the profile.")
    .action((platform: string, opts) =>
      process.exit(runExport(platform, { out: opts.out, noExtensions: !opts.extensions })),
    );

  program
    .command("import <bundle> <platform>")
    .description("Apply a previously exported profile bundle to a platform.")
    .option("--prune", "Remove extensions on target that aren't in the bundle.", false)
    .option("--no-extensions", "Skip installing extensions from the bundle.")
    .option("-n, --dry-run", "Show what would change without writing.", false)
    .action((bundle: string, platform: string, opts) =>
      process.exit(runImport(bundle, platform, { prune: opts.prune, noExtensions: !opts.extensions, dryRun: opts.dryRun })),
    );

  const ext = program.command("extensions").alias("ext").description("Inspect or sync extensions only.");
  ext
    .command("list <platform>")
    .description("List installed extensions for a platform.")
    .option("--json", "Emit JSON.", false)
    .action((platform: string, opts) => process.exit(runExtList(platform, { json: opts.json })));
  ext
    .command("sync <from> <to>")
    .description("Sync extensions from one platform to another.")
    .option("--prune", "Remove extensions on <to> that aren't in <from>.", false)
    .option("-n, --dry-run", "Show what would change without writing.", false)
    .action((from: string, to: string, opts) =>
      process.exit(runExtSync(from, to, { prune: opts.prune, dryRun: opts.dryRun })),
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
