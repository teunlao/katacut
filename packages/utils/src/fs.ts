import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import type { ReadTextFileOptions } from './types.js';

export async function readTextFile(path: string, options: ReadTextFileOptions = {}) {
	const encoding = options.encoding ?? 'utf8';
	const cwd = options.cwd ?? process.cwd();
	const absolutePath = resolve(cwd, path);
	return readFile(absolutePath, encoding);
}

export async function readConfigFile(path: string, options: ReadTextFileOptions = {}) {
	return readTextFile(path, options);
}
