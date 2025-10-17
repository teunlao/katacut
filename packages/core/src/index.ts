import type { KatacutConfig } from '@katacut/schema';

export interface SyncPlanTarget {
  readonly name: string;
  readonly actions: string[];
}

export interface SyncPlan {
  readonly summary: string;
  readonly targets: SyncPlanTarget[];
}

export function createSyncPlan(config: KatacutConfig): SyncPlan {
  const serverCount = Object.keys(config.mcp ?? {}).length;
  const summary =
    serverCount === 0 ? 'No MCP servers to synchronize' : `Prepared synchronization for ${serverCount} MCP server(s)`;

  return {
    summary,
    targets: []
  };
}
