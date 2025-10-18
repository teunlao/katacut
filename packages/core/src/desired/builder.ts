import type { KatacutConfig, McpServerConfig } from '@katacut/schema';
import type { ServerJson } from '../ports/adapters.js';

function normalizeHttpHeaders(headers: Record<string, string> | undefined): Record<string, string> | undefined {
	if (!headers) {
		return undefined;
	}
	const keys = Object.keys(headers);
	if (keys.length === 0) {
		return undefined;
	}
	return headers;
}

function toServerJson(entry: McpServerConfig): ServerJson {
	if (entry.transport === 'http') {
		return { type: 'http', url: entry.url, headers: normalizeHttpHeaders(entry.headers) };
	}
	if (entry.transport === 'sse') {
		return { type: 'sse', url: entry.url, headers: normalizeHttpHeaders(entry.headers) };
	}
	// stdio (normalize empty env to undefined)
	const env = entry.env && Object.keys(entry.env).length > 0 ? entry.env : undefined;
	return { type: 'stdio', command: entry.command, args: entry.args, env };
}

export function buildDesired(config: KatacutConfig): Record<string, ServerJson> {
	const out: Record<string, ServerJson> = {};
	const mcp = config.mcp ?? {};
	for (const [name, cfg] of Object.entries(mcp)) {
		out[name] = toServerJson(cfg);
	}
	return out;
}
