import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Lockfile, Scope } from '@katacut/core';
import { buildLock, diffDesiredCurrent } from '@katacut/core';
import type { KatacutConfig, McpServerConfig } from '@katacut/schema';
import type { Command } from 'commander';
import { getAdapter } from '../../lib/adapters/registry.js';
import { loadAndValidateConfig } from '../../lib/config.js';
import { REGISTRY_DEFAULT_BASE } from '../../lib/constants.js';
import { resolveFormatFlags } from '../../lib/format.js';
import { buildSummaryLine, printTableSection } from '../../lib/print.js';
import { resolveJsonDescriptor } from '../../lib/resolvers/json-url.js';
import {
	buildRegistryVersionUrl,
	isRegistryVersionUrl,
	resolveCanonicalNameByShort,
	resolveConcreteVersion,
	resolveFromRegistry,
} from '../../lib/resolvers/registry.js';
import { isSmitheryServerUrl } from '../../lib/resolvers/smithery.js';
import { appendProjectStateRun, buildStateEntries } from '../../lib/state.js';
import { normalizeRegistryVersion } from '../../lib/version.js';

function isHttpUrl(ref: string): URL | undefined {
	try {
		const u = new URL(ref);
		return u.protocol === 'http:' || u.protocol === 'https:' ? u : undefined;
	} catch {
		return undefined;
	}
}

// fetch JSON descriptor moved to lib/resolvers/json-url

// registry/smithery logic moved to lib/resolvers

export function registerMcpAdd(parent: Command) {
	parent
		.command('add')
		.description('Add an MCP server by URL or by registry name (URL autodetected)')
		.argument('<ref>', 'URL or registry name')
		.option('--client <id>', 'Client id (default: claude-code)')
		.option('--scope <scope>', 'Scope: project|user (default: project)')
		.option('--registry <url>', 'Registry base URL (default: official)')
		.option('--version <spec>', 'Registry version or range (default: latest)')
		.option('--save-exact', 'Pin concrete version in stdio args like npm --save-exact', false)
		.option('--dry-run', 'Print plan without applying', false)
		.option('-y, --yes', 'Confirm if permissions require explicit consent', false)
		.option('--json', 'Machine-readable output: only JSON plan', false)
		.option('--no-summary', 'Suppress tables/labels', false)
		.action(
			async (
				ref: string,
				opts: {
					readonly client?: string;
					readonly scope?: Scope;
					readonly json?: boolean;
					readonly noSummary?: boolean;
					readonly dryRun?: boolean;
					readonly yes?: boolean;
					readonly registry?: string;
					readonly version?: string;
					readonly saveExact?: boolean;
				},
			) => {
				const clientId = opts.client ?? 'claude-code';
				const adapter = await getAdapter(clientId);
				const cwd = process.cwd();
				const scope: Scope = opts.scope === 'user' ? 'user' : 'project';
				const fmt = resolveFormatFlags(process.argv, { json: opts.json, noSummary: opts.noSummary });

				// Resolve descriptor
				const asUrl = isHttpUrl(ref);
				let name: string;

				// 1) Smithery URL (streamable HTTP endpoint)
				if (asUrl && isSmitheryServerUrl(asUrl)) {
					const rsSmith = await (async () => ({
						name: asUrl.pathname.split('/').filter(Boolean).slice(-2, -1)[0]?.replace(/^@/, '') ?? 'server',
						config: { transport: 'http' as const, url: asUrl.toString() },
					}))();
					name = rsSmith.name;
					const cfgEntry: McpServerConfig = rsSmith.config;

					const config = await loadAndValidateConfig(undefined);
					const edited: KatacutConfig = { ...config, mcp: { ...(config.mcp ?? {}) } };
					if (!edited.mcp) edited.mcp = {};
					edited.mcp[name] = cfgEntry;
					const cfgPath = resolve(cwd, 'katacut.config.jsonc');
					await writeFile(cfgPath, JSON.stringify(edited, null, 2), 'utf8');

					const tmpDesired = adapter.desiredFromConfig(edited);
					const desired: Record<string, import('@katacut/core').ServerJson> = {};
					for (const [k, v] of Object.entries(tmpDesired))
						desired[k] =
							v.type === 'http' && v.headers && Object.keys(v.headers).length === 0 ? { type: 'http', url: v.url } : v;
					const current = scope === 'project' ? await adapter.readProject(cwd) : await adapter.readUser();
					const plan = diffDesiredCurrent(desired, current.mcpServers, false, true).filter((p) => p.name === name);
					console.log(JSON.stringify(plan, null, 2));
					printTableSection(
						'Plan',
						['Name', 'Action', 'Scope'],
						plan.map((p) => [p.name, p.action.toUpperCase(), String(scope)]),
						fmt,
					);
					if (opts.dryRun) return;
					const applyPlan = plan
						.filter((p) => p.action !== 'skip')
						.map((p) => ({ action: p.action as 'add' | 'update' | 'remove', name: p.name, json: p.json }));
					const summary = await adapter.applyInstall(applyPlan, scope, cwd);
					const skipped = plan.filter((p) => p.action === 'skip').length;
					if (!fmt.json && !fmt.noSummary) console.log(buildSummaryLine(summary, skipped));
					printTableSection(
						'Summary',
						['Added', 'Updated', 'Removed', 'Skipped', 'Failed'],
						[
							[
								String(summary.added),
								String(summary.updated),
								String(summary.removed),
								String(skipped),
								String(summary.failed),
							],
						],
						fmt,
					);
					if (summary.failed > 0) {
						process.exitCode = 1;
						return;
					}
					const expectedLock: Lockfile = buildLock([adapter.id], desired, scope);
					const lockPath = resolve(cwd, 'katacut.lock.json');
					await writeFile(lockPath, JSON.stringify(expectedLock, null, 2), 'utf8');
					const stateEntries = buildStateEntries(plan, desired, current.mcpServers, scope);
					await appendProjectStateRun(cwd, {
						at: new Date().toISOString(),
						client: adapter.id,
						requestedScope: scope,
						realizedScope: scope,
						mode: 'native',
						intent: 'project',
						result: summary,
						entries: stateEntries,
					});
					return;
				}
				if (asUrl && isRegistryVersionUrl(asUrl)) {
					const rs = await resolveFromRegistry(asUrl);
					name = rs.name;
					const cfgEntry = rs.config;

					const config = await loadAndValidateConfig(undefined);
					const edited: KatacutConfig = { ...config, mcp: { ...(config.mcp ?? {}) } };
					if (!edited.mcp) edited.mcp = {};
					edited.mcp[name] = cfgEntry;
					const cfgPath = resolve(cwd, 'katacut.config.jsonc');
					await writeFile(cfgPath, JSON.stringify(edited, null, 2), 'utf8');

					const tmpDesired2 = adapter.desiredFromConfig(edited);
					const desired = Object.fromEntries(
						Object.entries(tmpDesired2).map(([k, v]) =>
							v.type === 'http' && v.headers && Object.keys(v.headers).length === 0
								? [k, { type: 'http', url: v.url }]
								: [k, v],
						),
					) as Record<string, import('@katacut/core').ServerJson>;
					const current = scope === 'project' ? await adapter.readProject(cwd) : await adapter.readUser();
					const plan = diffDesiredCurrent(desired, current.mcpServers, false, true).filter((p) => p.name === name);
					console.log(JSON.stringify(plan, null, 2));
					printTableSection(
						'Plan',
						['Name', 'Action', 'Scope'],
						plan.map((p) => [p.name, p.action.toUpperCase(), String(scope)]),
						fmt,
					);
					if (opts.dryRun) return;
					const applyPlan = plan
						.filter((p) => p.action !== 'skip')
						.map((p) => ({ action: p.action as 'add' | 'update' | 'remove', name: p.name, json: p.json }));
					const summary = await adapter.applyInstall(applyPlan, scope, cwd);
					const skipped = plan.filter((p) => p.action === 'skip').length;
					if (!fmt.json && !fmt.noSummary) console.log(buildSummaryLine(summary, skipped));
					printTableSection(
						'Summary',
						['Added', 'Updated', 'Removed', 'Skipped', 'Failed'],
						[
							[
								String(summary.added),
								String(summary.updated),
								String(summary.removed),
								String(skipped),
								String(summary.failed),
							],
						],
						fmt,
					);
					if (summary.failed > 0) {
						process.exitCode = 1;
						return;
					}
					const expectedLock: Lockfile = buildLock([adapter.id], desired, scope);
					const lockPath = resolve(cwd, 'katacut.lock.json');
					await writeFile(lockPath, JSON.stringify(expectedLock, null, 2), 'utf8');
					const stateEntries = buildStateEntries(plan, desired, current.mcpServers, scope);
					await appendProjectStateRun(cwd, {
						at: new Date().toISOString(),
						client: adapter.id,
						requestedScope: scope,
						realizedScope: scope,
						mode: 'native',
						intent: 'project',
						result: summary,
						entries: stateEntries,
					});
					return;
				}

				if (asUrl) {
					const rsJson = await resolveJsonDescriptor(asUrl);
					name = rsJson.name;
					const cfgEntry = rsJson.config;

					// Load and edit config
					const config = await loadAndValidateConfig(undefined);
					const edited: KatacutConfig = { ...config, mcp: { ...(config.mcp ?? {}) } };
					if (!edited.mcp) edited.mcp = {};
					edited.mcp[name] = cfgEntry;
					const cfgPath = resolve(cwd, 'katacut.config.jsonc');
					await writeFile(cfgPath, JSON.stringify(edited, null, 2), 'utf8');

					// Plan and apply using adapter
					const desired = adapter.desiredFromConfig(edited);
					const current = scope === 'project' ? await adapter.readProject(cwd) : await adapter.readUser();
					const plan = diffDesiredCurrent(desired, current.mcpServers, false, true).filter((p) => p.name === name);

					// Output plan
					console.log(JSON.stringify(plan, null, 2));
					printTableSection(
						'Plan',
						['Name', 'Action', 'Scope'],
						plan.map((p) => [p.name, p.action.toUpperCase(), String(scope)]),
						fmt,
					);
					if (opts.dryRun) return;

					// Apply
					const applyPlan = plan
						.filter((p) => p.action !== 'skip')
						.map((p) => ({ action: p.action as 'add' | 'update' | 'remove', name: p.name, json: p.json }));
					const summary = await adapter.applyInstall(applyPlan, scope, cwd);
					const skipped = plan.filter((p) => p.action === 'skip').length;
					if (!fmt.json && !fmt.noSummary) console.log(buildSummaryLine(summary, skipped));
					printTableSection(
						'Summary',
						['Added', 'Updated', 'Removed', 'Skipped', 'Failed'],
						[
							[
								String(summary.added),
								String(summary.updated),
								String(summary.removed),
								String(skipped),
								String(summary.failed),
							],
						],
						fmt,
					);
					if (summary.failed > 0) {
						process.exitCode = 1;
						return;
					}

					// State & lock
					const expectedLock: Lockfile = buildLock([adapter.id], desired, scope);
					const lockPath = resolve(cwd, 'katacut.lock.json');
					await writeFile(lockPath, JSON.stringify(expectedLock, null, 2), 'utf8');
					const stateEntries = buildStateEntries(plan, desired, current.mcpServers, scope);
					await appendProjectStateRun(cwd, {
						at: new Date().toISOString(),
						client: adapter.id,
						requestedScope: scope,
						realizedScope: scope,
						mode: 'native',
						intent: 'project',
						result: summary,
						entries: stateEntries,
					});
					return;
				}

				// Name path (registry): support full (ns/name@ver) and short (name@ver via search)
				const at = (() => {
					const i = ref.lastIndexOf('@');
					return i > 0 ? i : -1;
				})();
				const rawName = at > 0 ? ref.slice(0, at) : ref;
				const userSpecRaw = at > 0 ? ref.slice(at + 1) : (opts.version ?? 'latest');
				// For bare numbers '5' / '5.4', npm semantics ~ '^5.0.0' / '^5.4.0' when resolving
				const userSpec = /^(\d+)(?:\.(\d+))?$/.test(userSpecRaw)
					? `^${normalizeRegistryVersion(userSpecRaw)}`
					: userSpecRaw;
				const base = opts.registry ?? REGISTRY_DEFAULT_BASE;
				try {
					const regName = rawName.includes('/') ? rawName : await resolveCanonicalNameByShort(rawName, base);
					const concrete = await resolveConcreteVersion(regName, userSpec, base);
					const url = buildRegistryVersionUrl(regName, concrete, base);
					const rs = await resolveFromRegistry(url, { requestedVersion: opts.saveExact ? concrete : undefined });
					name = rs.name;
					const cfgEntry: McpServerConfig = rs.config;

					const config = await loadAndValidateConfig(undefined);
					const edited: KatacutConfig = { ...config, mcp: { ...(config.mcp ?? {}) } };
					if (!edited.mcp) edited.mcp = {};
					edited.mcp[name] = cfgEntry;
					const cfgPath = resolve(cwd, 'katacut.config.jsonc');
					await writeFile(cfgPath, JSON.stringify(edited, null, 2), 'utf8');

					const desired = adapter.desiredFromConfig(edited);
					const current = scope === 'project' ? await adapter.readProject(cwd) : await adapter.readUser();
					const plan = diffDesiredCurrent(desired, current.mcpServers, false, true).filter((p) => p.name === name);
					console.log(JSON.stringify(plan, null, 2));
					printTableSection(
						'Plan',
						['Name', 'Action', 'Scope'],
						plan.map((p) => [p.name, p.action.toUpperCase(), String(scope)]),
						fmt,
					);
					if (opts.dryRun) return;

					const applyPlan = plan
						.filter((p) => p.action !== 'skip')
						.map((p) => ({ action: p.action as 'add' | 'update' | 'remove', name: p.name, json: p.json }));
					const summary = await adapter.applyInstall(applyPlan, scope, cwd);
					const skipped = plan.filter((p) => p.action === 'skip').length;
					if (!fmt.json && !fmt.noSummary) console.log(buildSummaryLine(summary, skipped));
					printTableSection(
						'Summary',
						['Added', 'Updated', 'Removed', 'Skipped', 'Failed'],
						[
							[
								String(summary.added),
								String(summary.updated),
								String(summary.removed),
								String(skipped),
								String(summary.failed),
							],
						],
						fmt,
					);
					if (summary.failed > 0) {
						process.exitCode = 1;
						return;
					}
					const expectedLock: Lockfile = buildLock([adapter.id], desired, scope);
					// Record resolved version in lock for this name (npm-like lock behavior)
					if (/^\d+\.\d+\.\d+/.test(concrete)) {
						const prev = expectedLock.mcpServers[name];
						expectedLock.mcpServers[name] = { ...prev, resolvedVersion: concrete };
					}
					const lockPath = resolve(cwd, 'katacut.lock.json');
					await writeFile(lockPath, JSON.stringify(expectedLock, null, 2), 'utf8');
					const stateEntries = buildStateEntries(plan, desired, current.mcpServers, scope);
					await appendProjectStateRun(cwd, {
						at: new Date().toISOString(),
						client: adapter.id,
						requestedScope: scope,
						realizedScope: scope,
						mode: 'native',
						intent: 'project',
						result: summary,
						entries: stateEntries,
					});
					return;
				} catch (e) {
					console.error(String(e instanceof Error ? e.message : e));
					process.exitCode = 1;
					return;
				}
			},
		);
}
