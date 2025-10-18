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
		targets: [],
	};
}

export type { ResolveConfigPathOptions } from './config.js';
export { DEFAULT_CONFIG_FILENAMES, resolveConfigPath } from './config.js';
export type { LockEntry, Lockfile } from './lock/format.js';
export { buildLock, computeFingerprint, mergeLock, verifyLock } from './lock/format.js';
export type { Action, ActionKind } from './plan/diff.js';
export { diffByNames, diffDesiredCurrent } from './plan/diff.js';
export type {
	ApplyResultSummary,
	ClientAdapter,
	InstallStep,
	ReadMcpResult,
	Scope,
	ServerJson,
	ServerJsonHttp,
	ServerJsonStdio,
} from './ports/adapters.js';
