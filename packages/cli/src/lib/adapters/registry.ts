import { claudeCodeAdapter } from '@katacut/adapter-client-claude-code';
import { geminiCliAdapter } from '@katacut/adapter-client-gemini-cli';
import type { ClientAdapter } from '@katacut/core';

const registry: Record<string, ClientAdapter> = {
	'claude-code': claudeCodeAdapter,
	'gemini-cli': geminiCliAdapter,
};

export async function getAdapter(id: string): Promise<ClientAdapter> {
	const adapter = registry[id];
	if (!adapter) throw new Error(`Unsupported client: ${id}`);
	return adapter;
}
