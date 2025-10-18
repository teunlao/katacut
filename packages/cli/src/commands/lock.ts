import { resolve } from 'node:path';
import { buildLock, type Lockfile, type Scope, verifyLock } from '@katacut/core';
import type { Command } from 'commander';
import { getAdapter } from '../lib/adapters/registry.js';
import { loadAndValidateConfig } from '../lib/config.js';

export function registerLockCommand(program: Command) {
	const cmd = program.command('lock').description('Lockfile utilities');

	cmd
		.command('generate')
		.description('Generate lockfile from config for selected clients')
		.option('-c, --config <path>', 'path to configuration file')
		.option('--client <id>', 'Client id (default: claude-code)')
		.option('--clients <ids>', 'Comma-separated client ids (overrides --client)')
		.option('--scope <scope>', 'Scope for desired servers (default: project)')
		.option('--out <path>', 'Write lockfile to path (if omitted, prints to stdout)')
		.action(async (opts: { config?: string; client?: string; clients?: string; scope?: Scope; out?: string }) => {
			const clientId = opts.client ?? 'claude-code';
			const list =
				(opts.clients
					? opts.clients
							.split(',')
							.map((s: string) => s.trim())
							.filter(Boolean)
					: []) || [];
			const clients = list.length > 0 ? list : [clientId];
			const adapters = await Promise.all(clients.map((c: string) => getAdapter(c)));
			const config = await loadAndValidateConfig(opts.config);
			// общий снимок один для всех клиентов
			const desiredRaw = adapters[0].desiredFromConfig(config);
			const desired: Record<string, import('@katacut/core').ServerJson> = {};
			for (const [k, v] of Object.entries(desiredRaw)) {
				if (v.type === 'http' && v.headers && Object.keys(v.headers).length === 0) {
					desired[k] = { type: 'http', url: v.url };
				} else desired[k] = v;
			}
			const scope: Scope = opts.scope === 'user' ? 'user' : 'project';
			const lock = buildLock(clients, desired, scope);
			if (opts.out) {
				const path = resolve(process.cwd(), opts.out);
				await (await import('node:fs/promises')).writeFile(path, JSON.stringify(lock, null, 2), 'utf8');
				console.log(`Wrote lockfile: ${path}`);
			} else {
				console.log(JSON.stringify(lock, null, 2));
			}
		});

	cmd
		.command('verify')
		.description('Verify current state against lockfile')
		.option('--file <path>', 'Lockfile path (default: katacut.lock.json)')
		.option('--client <id>', 'Client id (default: claude-code)')
		.action(async (opts: { file?: string; client?: string }) => {
			const clientId = opts.client ?? 'claude-code';
			const adapter = await getAdapter(clientId);
			const cwd = process.cwd();
			const path = resolve(cwd, opts.file ?? 'katacut.lock.json');
			const text = await (await import('node:fs/promises')).readFile(path, 'utf8');
			const lock = JSON.parse(text) as Lockfile;
			const project = await adapter.readProject(cwd);
			const user = await adapter.readUser();
			const report = verifyLock(lock, project, user);
			console.log(JSON.stringify(report, null, 2));
			if (report.status !== 'ok') process.exitCode = 1;
		});
}
