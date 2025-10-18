import { constants } from 'node:fs';
import { access } from 'node:fs/promises';
import { resolve } from 'node:path';

export const DEFAULT_CONFIG_FILENAMES = [
	'katacut.config.jsonc',
	'katacut.config.json',
	'katacut.jsonc',
	'katacut.json',
] as const;

export interface ResolveConfigPathOptions {
	cwd?: string;
	candidates?: readonly string[];
}

export async function resolveConfigPath(options: ResolveConfigPathOptions = {}) {
	const cwd = options.cwd ?? process.cwd();
	const candidates = options.candidates ?? DEFAULT_CONFIG_FILENAMES;

	for (const candidate of candidates) {
		const absolutePath = resolve(cwd, candidate);
		try {
			await access(absolutePath, constants.F_OK);
			return absolutePath;
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
				continue;
			}
			throw error;
		}
	}

	return undefined;
}
