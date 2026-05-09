import { assign, parse, stringify } from "comment-json";

export function parseJsonc<T = unknown>(text: string): T {
  return parse(text) as unknown as T;
}

export function stringifyJsonc(value: unknown, indent = 2): string {
  return stringify(value, null, indent);
}

export function mergeJsonc<T extends object>(base: T, incoming: T): T {
  return assign(base, incoming) as T;
}
