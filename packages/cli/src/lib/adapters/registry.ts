import type { ClientAdapter } from "@katacut/core";
import { claudeAdapter } from "@katacut/adapter-client-claude";

const registry: Record<string, ClientAdapter> = {
  "claude-code": claudeAdapter,
};

export async function getAdapter(id: string): Promise<ClientAdapter> {
  const adapter = registry[id];
  if (!adapter) throw new Error(`Unsupported client: ${id}`);
  return adapter;
}
