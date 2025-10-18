import { homedir } from 'node:os';
import { join } from 'node:path';
import {
	extractMcpServers as extractShared,
	readJsonSafe,
	removeMcpServerWithBackup,
} from '@katacut/adapter-clients-shared';
import type { ReadMcpResult } from '@katacut/core';
import { fromGeminiServerJson } from './map.js';

async function readJson(path: string): Promise<unknown | undefined> {
	return readJsonSafe(path);
}

// Use shared extractor with mapper fromGeminiServerJson

export async function readProjectGemini(cwd = process.cwd()): Promise<ReadMcpResult> {
	const path = join(cwd, '.gemini', 'settings.json');
	const parsed = await readJson(path);
	const servers = extractShared(parsed, fromGeminiServerJson) ?? {};
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
		const servers = extractShared(parsed, fromGeminiServerJson);
		if (servers && Object.keys(servers).length > 0) return { source: file, mcpServers: servers };
	}
	return { mcpServers: {} };
}

export async function fallbackRemoveGemini(
	name: string,
	scope: 'project' | 'user',
	cwd = process.cwd(),
): Promise<boolean> {
	const path =
		scope === 'project' ? join(cwd, '.gemini', 'settings.json') : join(homedir(), '.gemini', 'settings.json');
	return removeMcpServerWithBackup(path, name);
}
