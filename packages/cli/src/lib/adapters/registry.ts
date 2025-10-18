import { claudeCodeAdapter } from "@katacut/adapter-client-claude-code";
import type { ClientAdapter } from "@katacut/core";

const registry: Record<string, ClientAdapter> = {
	"claude-code": claudeCodeAdapter,
};

export async function getAdapter(id: string): Promise<ClientAdapter> {
	const adapter = registry[id];
	if (!adapter) throw new Error(`Unsupported client: ${id}`);
	return adapter;
}
