import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export interface ReadConfigFileOptions {
  readonly cwd?: string;
}

export async function readConfigFile(path: string, options: ReadConfigFileOptions = {}) {
  const cwd = options.cwd ?? process.cwd();
  const absolutePath = resolve(cwd, path);
  return readFile(absolutePath, 'utf8');
}
