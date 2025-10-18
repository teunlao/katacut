import { homedir } from 'node:os';
import { join } from 'node:path';
import { extractMcpServers, readJsonSafe, removeMcpServerWithBackup } from '@katacut/adapter-clients-shared';
import { isPlainObject } from '@katacut/utils';

import type { ClaudeServerJson } from './types.js';

export interface ReadMcpResult {
	readonly source?: string;

	readonly mcpServers: Record<string, ClaudeServerJson>;
}

function mapClaudeEntry(entry: unknown): ClaudeServerJson | undefined {
	if (!isPlainObject(entry)) return undefined;
	const t = entry.type;
	if (t === 'http') {
		const url = typeof entry.url === 'string' ? entry.url : undefined;
		if (!url) return undefined;
		const headers = isPlainObject(entry.headers)
			? Object.fromEntries(Object.entries(entry.headers).filter(([, v]) => typeof v === 'string') as [string, string][])
			: undefined;
		return { type: 'http', url, headers };
	}
	if (t === 'stdio') {
		const command = typeof entry.command === 'string' ? entry.command : undefined;
		if (!command) return undefined;
		const args = Array.isArray(entry.args) ? (entry.args.filter((a) => typeof a === 'string') as string[]) : undefined;
		const envObj = isPlainObject(entry.env)
			? Object.fromEntries(Object.entries(entry.env).filter(([, v]) => typeof v === 'string') as [string, string][])
			: undefined;
		const env = envObj && Object.keys(envObj).length > 0 ? envObj : undefined;
		return { type: 'stdio', command, args, env };
	}
	return undefined;
}

export async function readProjectMcp(cwd = process.cwd()): Promise<ReadMcpResult> {
	const path = join(cwd, '.mcp.json');
	const parsed = await readJsonSafe(path);
	const servers = extractMcpServers(parsed, mapClaudeEntry) ?? {};
	return { source: servers && Object.keys(servers).length > 0 ? path : undefined, mcpServers: servers };
}

export async function fallbackRemoveClaude(
	name: string,
	scope: 'project' | 'user',
	cwd = process.cwd(),
): Promise<boolean> {
	const candidates: string[] = [];
	if (scope === 'project') {
		candidates.push(join(cwd, '.mcp.json'));
	} else {
		const home = homedir();
		const xdg = process.env.XDG_CONFIG_HOME
			? join(process.env.XDG_CONFIG_HOME, 'claude')
			: join(home, '.config', 'claude');
		candidates.push(join(home, '.claude', 'settings.json'));
		candidates.push(join(home, '.claude.json'));
		candidates.push(join(xdg, 'settings.json'));
		candidates.push(join(xdg, 'config.json'));
		if (process.env.USERPROFILE) candidates.push(join(process.env.USERPROFILE, '.claude', 'settings.json'));
		if (process.env.USERPROFILE) candidates.push(join(process.env.USERPROFILE, '.claude.json'));
		if (process.env.APPDATA) candidates.push(join(process.env.APPDATA, 'Claude', 'settings.json'));
	}
	for (const path of candidates) {
		const ok = await removeMcpServerWithBackup(path, name);
		if (ok) return true;
	}
	return false;
}

export async function readUserMcp(): Promise<ReadMcpResult> {
	const home = homedir();
	const xdg = process.env.XDG_CONFIG_HOME
		? join(process.env.XDG_CONFIG_HOME, 'claude')
		: join(home, '.config', 'claude');
	const candidates: string[] = [
		// POSIX-style locations (macOS/Linux)
		join(home, '.claude', 'settings.json'),
		join(home, '.claude.json'),
		join(xdg, 'settings.json'),
		join(xdg, 'config.json'),
	];
	// Windows-style locations (additionally checked on all platforms; existence decides)
	if (process.env.USERPROFILE) {
		candidates.push(join(process.env.USERPROFILE, '.claude', 'settings.json'));
		candidates.push(join(process.env.USERPROFILE, '.claude.json'));
	}
	if (process.env.APPDATA) {
		candidates.push(join(process.env.APPDATA, 'Claude', 'settings.json'));
	}
	for (const file of candidates) {
		const parsed = await readJsonSafe(file);
		const servers = extractMcpServers(parsed, mapClaudeEntry);
		if (servers && Object.keys(servers).length > 0) return { source: file, mcpServers: servers };
	}
	return { mcpServers: {} };
}
