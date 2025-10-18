import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Action } from '@katacut/core';
import { buildDesired, buildLock, diffDesiredCurrent, type Lockfile } from '@katacut/core';
import type { KatacutConfig } from '@katacut/schema';
import type { Command } from 'commander';
import { getAdapter } from '../../lib/adapters/registry.js';
import { loadAndValidateConfig } from '../../lib/config.js';
import { resolveFormatFlags } from '../../lib/format.js';
import { appendProjectStateRun, buildStateEntries } from '../../lib/state.js';

interface RemoveOptions {
	readonly client: string;
	readonly scope?: 'project' | 'user' | 'both';
	readonly dryRun?: boolean;
	readonly json?: boolean;
	readonly noSummary?: boolean;
	readonly local?: boolean;
	readonly yes?: boolean;
	readonly config?: string;
}

export function registerMcpRemove(parent: Command) {
	parent
		.command('remove')
		.description('Remove one or more MCP servers by name')
		.argument('<names...>', 'Server names to remove')
		.requiredOption('--client <id>', 'Client id (e.g., claude-code)')
		.option('--scope <scope>', 'Scope: project|user|both (default: project)')
		.option('--dry-run', 'Print plan without changes', false)
		.option('--json', 'Machine-readable output: only JSON plan', false)
		.option('--no-summary', 'Suppress tables/labels', false)
		.option('--local', 'Remove locally only (do not touch config/lock)', false)
		.option('-y, --yes', 'Confirm removal when --local is used', false)
		.option('-c, --config <path>', 'Config path (when editing config)')
		.action(async (names: string[], opts: RemoveOptions) => {
			const cwd = process.cwd();
			const clientId = opts.client;
			const adapter = await getAdapter(clientId);
			const scopeOpt = opts.scope ?? 'project';
			const scopes: ('project' | 'user')[] = scopeOpt === 'both' ? ['project', 'user'] : [scopeOpt];

			if (opts.local && !opts.yes && !opts.dryRun) {
				console.error('Refusing to remove locally without confirmation. Re-run with --local -y to proceed.');
				process.exitCode = 1;
				return;
			}

			// Build plan JSON structure
			const planJson: ReadonlyArray<{
				readonly name: string;
				readonly scopes: readonly string[];
				readonly action: 'remove';
			}> = names.map((n) => ({ name: n, scopes, action: 'remove' as const }));
			const fmt = resolveFormatFlags(process.argv, { json: opts.json, noSummary: opts.noSummary });
			if (!fmt.json && !fmt.noSummary) {
				console.log('Plan:');
			}
			console.log(JSON.stringify(planJson, null, 2));
			if (opts.dryRun) return;

			if (opts.local) {
				// Local-only: apply removals via adapter without touching config/lock; write state with intent=local
				let failed = 0;
				let removed = 0;
				for (const s of scopes) {
					const result = await adapter.applyInstall(
						names.map((n) => ({ action: 'remove' as const, name: n })),
						s,
						cwd,
					);
					failed += result.failed;
					removed += result.removed;
				}
				const _current = scopes.includes('project') ? await adapter.readProject(cwd) : await adapter.readUser();
				await appendProjectStateRun(cwd, {
					at: new Date().toISOString(),
					client: adapter.id,
					requestedScope: scopes[0],
					realizedScope: scopes[0],
					mode: 'native',
					intent: 'local',
					result: { added: 0, updated: 0, removed, failed },
					entries: Object.fromEntries(names.map((n) => [n, { scope: scopes[0], outcome: 'remove' as const }])),
				});
				if (failed > 0) process.exitCode = 1;
				return;
			}

			// Default: edit config and prune via internal apply
			const config = await loadAndValidateConfig(opts.config);
			// Remove names from config.mcp
			const edited: KatacutConfig = { ...config, mcp: { ...(config.mcp ?? {}) } };
			for (const n of names) delete edited.mcp?.[n];
			// Compute desired and current for first scope (if both, handle project then user)
			for (const s of scopes) {
				const desired = buildDesired(edited);
				const current = s === 'project' ? await adapter.readProject(cwd) : await adapter.readUser();
				const plan = diffDesiredCurrent(desired, current.mcpServers, true, true);
				const applyPlan = plan
					.filter((p): p is Action & { action: 'add' | 'update' | 'remove' } => p.action !== 'skip')
					.map((p) => ({ action: p.action, name: p.name, json: p.json }));
				const summary = await adapter.applyInstall(applyPlan, s, cwd);
				const mode: 'native' | 'emulated' = 'native';
				const stateEntries = buildStateEntries(plan, desired, current.mcpServers, s);
				await appendProjectStateRun(cwd, {
					at: new Date().toISOString(),
					client: adapter.id,
					requestedScope: s,
					realizedScope: s,
					mode,
					intent: 'project',
					result: summary,
					entries: stateEntries,
				});
				// Write lock for this scope
				const lock: Lockfile = buildLock([adapter.id], desired, s);
				const lockPath = resolve(cwd, 'katacut.lock.json');
				await writeFile(lockPath, JSON.stringify(lock, null, 2), 'utf8');
			}

			// Persist edited config back to file
			const cfgPath = resolve(cwd, opts.config ?? 'katacut.config.jsonc');
			await writeFile(cfgPath, JSON.stringify(edited, null, 2), 'utf8');
		});
}
