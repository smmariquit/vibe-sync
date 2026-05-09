import pc from "picocolors";

export const log = {
  info: (msg: string) => console.log(`${pc.cyan("›")} ${msg}`),
  success: (msg: string) => console.log(`${pc.green("✓")} ${msg}`),
  warn: (msg: string) => console.warn(`${pc.yellow("⚠")} ${msg}`),
  error: (msg: string) => console.error(`${pc.red("✗")} ${msg}`),
  step: (msg: string) => console.log(`${pc.magenta("◆")} ${pc.bold(msg)}`),
  dim: (msg: string) => console.log(pc.dim(msg)),
  raw: (msg: string) => console.log(msg),
  header: (msg: string) => {
    const line = "─".repeat(Math.max(8, msg.length + 4));
    console.log(pc.dim(line));
    console.log(`  ${pc.bold(msg)}`);
    console.log(pc.dim(line));
  },
};

export const c = pc;
