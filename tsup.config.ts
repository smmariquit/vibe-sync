import { defineConfig } from "tsup";

export default defineConfig({
  entry: { cli: "src/cli.ts" },
  format: ["esm"],
  target: "node18",
  outDir: "dist",
  clean: true,
  sourcemap: false,
  splitting: false,
  shims: true,
  banner: { js: "#!/usr/bin/env node" },
  minify: false,
  dts: false,
});
