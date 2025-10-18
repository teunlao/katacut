import { constants } from 'node:fs';
import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Lockfile } from '@katacut/core';
import { verifyLock } from '@katacut/core';
import { deepEqualStable } from '@katacut/utils';
import type { Command } from 'commander';
import { getAdapter } from '../lib/adapters/registry.js';
import { resolveFormatFlags } from '../lib/format.js';
import { printTableSection } from '../lib/print.js';
import { readProjectState } from '../lib/state.js';

interface PathCheck {
	readonly path: string;
	readonly readable?: boolean;
	readonly writable?: boolean;
}

interface DoctorReport {
	readonly client: string;
	readonly cli?: { readonly available: boolean };
	readonly project?: { readonly path: string; readonly readable?: boolean; readonly writable?: boolean };
	readonly user?: { readonly path?: string; readonly readable?: boolean; readonly writable?: boolean };
	readonly conflicts?: readonly string[];
	readonly lock?: {
		readonly path: string;
		readonly readable: boolean;
		readonly status: 'ok' | 'mismatch' | 'missing';
		readonly mismatches?: ReadonlyArray<{
			readonly name: string;
			readonly expectedScope?: 'project' | 'user';
			readonly actual?: { readonly scope?: 'project' | 'user'; readonly fingerprint?: string };
			readonly reason: 'missing' | 'fingerprint' | 'scope' | 'extra';
		}>;
	};
	readonly capabilities?: {
		readonly supportsProject: boolean;
		readonly supportsUser: boolean;
		readonly emulateProjectWithUser: boolean;
		readonly supportsGlobalExplicit: boolean;
	};
	readonly realized?: {
		readonly at: string;
		readonly requestedScope: 'project' | 'user';
		readonly realizedScope: 'project' | 'user';
		readonly mode: 'native' | 'emulated';
	};
	readonly localOverrides?: ReadonlyArray<{
		name: string;
		scope: 'project' | 'user';
		action: 'add' | 'update' | 'remove' | 'skip';
	}>;
	readonly status: 'ok' | 'warn' | 'error';
}

async function checkPath(path: string): Promise<PathCheck> {
	let readable = false;
	let writable = false;
	try {
		await access(path, constants.R_OK);
		readable = true;
	} catch {
		readable = false;
	}
	try {
		await access(path, constants.W_OK);
		writable = true;
	} catch {
		writable = false;
	}
	return { path, readable, writable };
}

export function registerDoctorCommand(program: Command) {
	program
		.command('doctor')
		.description('Environment diagnostics for the selected client')
		.option('--client <id>', 'Client id (default: claude-code)')
		.option('--json', 'machine-readable output: only JSON report (no summary)')
		.option('--no-summary', 'suppress human summary table')
		.action(async (options: { readonly client?: string; readonly json?: boolean; readonly noSummary?: boolean }) => {
			const clientId = options.client ?? 'claude-code';
			const adapter = await getAdapter(clientId);
			const cwd = process.cwd();

			const cliAvailable = (await adapter.checkAvailable?.()) ?? true;
			const caps = (await adapter.capabilities?.()) ?? {
				supportsProject: true,
				supportsUser: true,
				emulateProjectWithUser: false,
				supportsGlobalExplicit: false,
			};

			const project = await adapter.readProject(cwd);
			const projectPath = project.source ?? join(cwd, '.mcp.json');
			const projectCheck = await checkPath(projectPath);

			const user = await adapter.readUser();
			const userPath = user.source;
			const userCheck = userPath ? await checkPath(userPath) : undefined;

			const conflicts: string[] = [];
			for (const [name, json] of Object.entries(project.mcpServers)) {
				const u = user.mcpServers[name];
				if (u && !deepEqualStable(u, json)) conflicts.push(name);
			}

			// Optional: lock verification
			const lockPath = join(cwd, 'katacut.lock.json');
			let lockBlock: DoctorReport['lock'] = { path: lockPath, readable: false, status: 'missing' };
			try {
				const text = await readFile(lockPath, 'utf8');
				const lock = JSON.parse(text) as Lockfile;
				const rep = verifyLock(lock, project, user);
				lockBlock = { path: lockPath, readable: true, status: rep.status, mismatches: rep.mismatches };
			} catch {
				lockBlock = { path: lockPath, readable: false, status: 'missing' };
			}

			const state = await readProjectState(cwd);
			const last = state?.runs?.[0];

			const hasErrors = !cliAvailable;
			const hasWarns =
				conflicts.length > 0 ||
				!projectCheck.writable ||
				(userCheck && userCheck.writable === false) ||
				!last ||
				lockBlock.status === 'mismatch' ||
				lockBlock.status === 'missing';
			const status: DoctorReport['status'] = hasErrors ? 'error' : hasWarns ? 'warn' : 'ok';

			// Local overrides classification (simple: last intent=local -> list entries)
			const localOverrides =
				last && last.intent === 'local'
					? Object.entries(last.entries)
							.filter(
								([, e]) =>
									e.outcome === 'add' || e.outcome === 'update' || e.outcome === 'remove' || e.outcome === 'skip',
							)
							.map(([name, e]) => ({
								name,
								scope: e.scope as 'project' | 'user',
								action: e.outcome as 'add' | 'update' | 'remove' | 'skip',
							}))
					: [];

			const report: DoctorReport = {
				client: adapter.id,
				cli: { available: cliAvailable },
				project: { path: projectCheck.path, readable: projectCheck.readable, writable: projectCheck.writable },
				user: userCheck ? { path: userCheck.path, readable: userCheck.readable, writable: userCheck.writable } : {},
				conflicts,
				lock: lockBlock,
				capabilities: caps,
				status,
				realized: last
					? { at: last.at, requestedScope: last.requestedScope, realizedScope: last.realizedScope, mode: last.mode }
					: undefined,
				localOverrides,
			};

			const fmt = resolveFormatFlags(process.argv, options);
			console.log(JSON.stringify(report, null, 2));
			if (!fmt.json && !fmt.noSummary) {
				// Human-friendly summary
				const headers: readonly string[] = ['Item', 'Value'];
				const rows: readonly (readonly string[])[] = [
					['Client', report.client],
					['CLI Available', String(report.cli?.available ?? false)],
					['Project Path', String(report.project?.path ?? '')],
					['Project R/W', `${report.project?.readable ? 'R' : '-'}${report.project?.writable ? 'W' : '-'}`],
					['User Path', String(report.user?.path ?? '')],
					['User R/W', `${report.user?.readable ? 'R' : '-'}${report.user?.writable ? 'W' : '-'}`],
					['Conflicts', report.conflicts && report.conflicts.length > 0 ? report.conflicts.join(', ') : 'none'],
					['Lock Path', report.lock?.path ?? ''],
					['Lock Status', report.lock?.status ?? 'missing'],
					['Status', report.status],
				];
				printTableSection('Doctor Summary', headers, rows, fmt);
				const recs: string[] = [];
				if (!cliAvailable) recs.push('Install or expose client CLI in PATH.');
				if (!projectCheck.writable) recs.push('Make project .mcp.json writable or run with appropriate permissions.');
				if (userCheck && userCheck.writable === false) recs.push('Fix user settings permissions.');
				if (conflicts.length > 0) recs.push('Resolve project/user conflicts or run install with desired scope.');
				if (!last) recs.push("Run 'ktc install' to record local state for diagnostics.");
				if (report.lock?.status === 'missing')
					recs.push("Generate lockfile: 'ktc lock generate' or run 'ktc install'.");
				if (report.lock?.status === 'mismatch')
					recs.push("Run 'ktc lock verify' to inspect mismatches; then 'ktc install' or update lock.");
				if (recs.length > 0) {
					console.log('Recommendations:');
					for (const r of recs) console.log(`- ${r}`);
				}
			}
		});
}
