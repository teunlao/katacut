import type { ClientAdapter } from "@katacut/core";
import { claudeAdapter } from "@katacut/adapter-client-claude-code";

const registry: Record<string, ClientAdapter> = {
  ClaudeCode: claudeAdapter,
};

export async function getAdapter(id: string): Promise<ClientAdapter> {
  const adapter = registry[id];
  if (!adapter) throw new Error(`Unsupported client: ${id}`);
  return adapter;
}
