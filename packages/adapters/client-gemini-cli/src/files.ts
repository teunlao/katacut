import { homedir } from 'node:os';
import { join } from 'node:path';
import type { ReadMcpResult } from '@katacut/core';
import { readTextFile } from '@katacut/utils';
import { fromGeminiServerJson } from './map.js';

function isObject(v: unknown): v is Record<string, unknown> {
	return typeof v === 'object' && v !== null && !Array.isArray(v);
}

async function readJson(path: string): Promise<unknown | undefined> {
	try {
		return JSON.parse(await readTextFile(path));
	} catch {
		return undefined;
	}
}

function extractMcpServers(root: unknown): Record<string, import('@katacut/core').ServerJson> | undefined {
	if (!isObject(root)) return undefined;
	const direct = (root as Record<string, unknown>).mcpServers;
	if (isObject(direct)) {
		const out: Record<string, import('@katacut/core').ServerJson> = {};
		for (const [name, val] of Object.entries(direct)) {
			const sj = fromGeminiServerJson(val);
			if (sj) out[name] = sj;
		}
		return out;
	}
	// recursive deep search
	for (const v of Object.values(root)) {
		const e = extractMcpServers(v);
		if (e) return e;
	}
	return undefined;
}

export async function readProjectGemini(cwd = process.cwd()): Promise<ReadMcpResult> {
	const path = join(cwd, '.gemini', 'settings.json');
	const parsed = await readJson(path);
	const servers = extractMcpServers(parsed) ?? {};
	return { source: Object.keys(servers).length > 0 ? path : undefined, mcpServers: servers };
}

export async function readUserGemini(): Promise<ReadMcpResult> {
	const home = homedir();
	const candidates: string[] = [join(home, '.gemini', 'settings.json')];
	// Windows
	if (process.env.USERPROFILE) candidates.push(join(process.env.USERPROFILE, '.gemini', 'settings.json'));
	// System managed (read-only, lowest priority for discovery)
	const systemCandidates: string[] = [];
	if (process.platform === 'darwin') {
		systemCandidates.push(join('/Library', 'Application Support', 'GeminiCli', 'settings.json'));
	} else if (process.platform === 'linux') {
		systemCandidates.push('/etc/gemini-cli/settings.json');
	} else if (process.platform === 'win32') {
		systemCandidates.push(join('C:\\ProgramData', 'gemini-cli', 'settings.json'));
	}

	for (const file of [...candidates, ...systemCandidates]) {
		const parsed = await readJson(file);
		const servers = extractMcpServers(parsed);
		if (servers && Object.keys(servers).length > 0) return { source: file, mcpServers: servers };
	}
	return { mcpServers: {} };
}
