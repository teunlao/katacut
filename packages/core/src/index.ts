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
  const clients = Array.isArray((config as { clients?: unknown }).clients)
    ? ((config as { clients: unknown[] }).clients.length ?? 0)
    : Object.keys(((config as { clients?: Record<string, unknown> }).clients) ?? {}).length;

  const summary =
    clients === 0 ? 'No clients to synchronize' : `Prepared synchronization for ${clients} client(s)`;

  return {
    summary,
    targets: []
  };
}
