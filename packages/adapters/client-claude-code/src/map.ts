import type { McpServerConfig } from '@katacut/schema';
import type { ClaudeServerJson } from './types.js';

export function toClaudeServerJson(server: McpServerConfig): ClaudeServerJson {
	if (server.transport === 'http') {
		return { type: 'http', url: server.url, headers: server.headers };
	}
	if (server.transport === 'stdio') {
		return { type: 'stdio', command: server.command, args: server.args, env: server.env };
	}
	// SSE не поддерживается в Claude Code напрямую; пробуем трактовать как HTTP.
	return { type: 'http', url: server.url, headers: server.headers };
}
