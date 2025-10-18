import { rename, writeFile } from 'node:fs/promises';
import { readTextFile, stableStringify } from '@katacut/utils';

export async function readJsonSafe(path: string): Promise<unknown | undefined> {
	try {
		const text = await readTextFile(path);
		return JSON.parse(text) as unknown;
	} catch {
		return undefined;
	}
}

export async function writeJsonAtomicStable(path: string, data: unknown): Promise<void> {
	const tmp = `${path}.tmp`;
	const text = `${stableStringify(data)}\n`;
	await writeFile(tmp, text, 'utf8');
	await rename(tmp, path);
}

export function extractMcpServers<TResult>(
	root: unknown,
	mapFn: (entry: unknown) => TResult | undefined,
): Record<string, TResult> | undefined {
	if (!root || typeof root !== 'object' || Array.isArray(root)) {
		return undefined;
	}
	const obj = root as Record<string, unknown>;
	const maybe = obj.mcpServers;
	if (maybe && typeof maybe === 'object' && !Array.isArray(maybe)) {
		const out: Record<string, TResult> = {};
		for (const [name, val] of Object.entries(maybe as Record<string, unknown>)) {
			const mapped = mapFn(val);
			if (mapped) out[name] = mapped;
		}
		return out;
	}
	for (const v of Object.values(obj)) {
		const nested = extractMcpServers<TResult>(v, mapFn);
		if (nested) return nested;
	}
	return undefined;
}

export async function removeMcpServerWithBackup(path: string, name: string): Promise<boolean> {
	const parsed = await readJsonSafe(path);
	if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return false;
	const root = parsed as Record<string, unknown> & { mcpServers?: Record<string, unknown> };
	if (!root.mcpServers || typeof root.mcpServers !== 'object') return false;
	if (!(name in root.mcpServers)) return false;
	const backup = `${path}.bak`;
	try {
		await writeJsonAtomicStable(backup, root);
		const next = { ...root, mcpServers: { ...(root.mcpServers as Record<string, unknown>) } };
		delete (next.mcpServers as Record<string, unknown>)[name];
		await writeJsonAtomicStable(path, next);
		return true;
	} catch {
		return false;
	}
}
