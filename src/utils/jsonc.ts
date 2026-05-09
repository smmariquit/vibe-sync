import { parse, stringify, assign } from "comment-json";

/**
 * VSCode-family editors store user files (settings.json, keybindings.json,
 * tasks.json) as JSON-with-Comments. We use `comment-json` so round-tripping
 * preserves the user's comments and trailing commas.
 */

export function parseJsonc<T = unknown>(text: string): T {
  // `parse` returns a tree that prints back with comments preserved.
  return parse(text) as unknown as T;
}

export function stringifyJsonc(value: unknown, indent = 2): string {
  return stringify(value, null, indent);
}

/**
 * Deep-merge `incoming` onto `base` while keeping comments attached to
 * surviving nodes. Arrays are replaced wholesale (matching VSCode's own
 * settings semantics — a user array means "use this array").
 */
export function mergeJsonc<T extends object>(base: T, incoming: T): T {
  return assign(base, incoming) as T;
}
