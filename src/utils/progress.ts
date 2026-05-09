import pc from "picocolors";

export interface ProgressOptions {
  total: number;
  width?: number;
  prefix?: string;
}

export class Progress {
  private current = 0;
  private readonly total: number;
  private readonly width: number;
  private readonly prefix: string;
  private readonly tty: boolean;

  constructor(opts: ProgressOptions) {
    this.total = opts.total;
    this.width = opts.width ?? 24;
    this.prefix = opts.prefix ?? "";
    this.tty = Boolean(process.stdout.isTTY) && !process.env.CI;
  }

  start(label: string): void {
    if (!this.tty) return;
    const ratio = Math.min(1, this.current / this.total);
    const filled = Math.round(ratio * this.width);
    const bar = pc.green("█".repeat(filled)) + pc.dim("░".repeat(this.width - filled));
    const counter = `${this.current}/${this.total}`;
    process.stdout.write(`\r${this.prefix}${bar} ${counter} ${label}\x1b[K`);
  }

  finish(label: string, status: "ok" | "fail"): void {
    this.current++;
    if (!this.tty) {
      const tag = status === "ok" ? pc.green("✓") : pc.red("✗");
      console.log(`${this.prefix}${tag} [${this.current}/${this.total}] ${label}`);
      return;
    }
    const ratio = Math.min(1, this.current / this.total);
    const filled = Math.round(ratio * this.width);
    const bar = pc.green("█".repeat(filled)) + pc.dim("░".repeat(this.width - filled));
    const counter = `${this.current}/${this.total}`;
    process.stdout.write(`\r${this.prefix}${bar} ${counter} ${label}\x1b[K`);
  }

  done(): void {
    if (this.tty && this.total > 1) process.stdout.write("\r\x1b[K");
  }
}
