import { SMITHERY_SERVER_HOST } from '../constants.js';
import type { ResolvedServer } from './types.js';

export function isSmitheryServerUrl(u: URL): boolean {
	return u.hostname === SMITHERY_SERVER_HOST && /\/mcp\/?$/.test(u.pathname);
}

function nameFromSmitheryUrl(u: URL): string {
	const parts = u.pathname.split('/').filter(Boolean);
	const idx = parts.lastIndexOf('mcp');
	const base = idx > 0 ? parts[idx - 1] : (parts.pop() ?? 'server');
	return base.replace(/^@/, '');
}

export function resolveSmithery(u: URL): ResolvedServer {
	const name = nameFromSmitheryUrl(u);
	return { name, config: { transport: 'http', url: u.toString() } };
}
