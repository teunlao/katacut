import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export interface ReadTextFileOptions {
  cwd?: string;
  encoding?: BufferEncoding;
}

export async function readTextFile(path: string, options: ReadTextFileOptions = {}) {
  const encoding = options.encoding ?? "utf8";
  const cwd = options.cwd ?? process.cwd();
  const absolutePath = resolve(cwd, path);
  return readFile(absolutePath, encoding);
}

export async function readConfigFile(path: string, options: ReadTextFileOptions = {}) {
  return readTextFile(path, options);
}

export class KatacutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KatacutError";
  }
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new KatacutError(message);
  }
}
