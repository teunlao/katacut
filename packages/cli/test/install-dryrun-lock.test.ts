import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Command } from 'commander';
import { describe, expect, it, vi } from 'vitest';

describe('kc install --dry-run lockfile behavior', () => {
	it('does not create lock when absent', async () => {
		const dir = await mkdtemp(join(tmpdir(), 'kc-dryrun-absent-'));
		try {
			await writeFile(
				join(dir, 'katacut.config.jsonc'),
				JSON.stringify({
					version: '0.1.0',
					clients: ['claude-code'],
					mcp: { a: { transport: 'http', url: 'https://a' } },
				}),
				'utf8',
			);
			await writeFile(join(dir, '.mcp.json'), JSON.stringify({ mcpServers: {} }), 'utf8');

			vi.resetModules();
			vi.doMock('../src/lib/adapters/registry.ts', () => {
				const adapter = {
					id: 'claude-code',
					checkAvailable: async () => true,
					readProject: async () => ({ mcpServers: {} }),
					readUser: async () => ({ mcpServers: {} }),
					desiredFromConfig: () => ({ a: { type: 'http', url: 'https://a' } }),
					applyInstall: async () => ({ added: 1, updated: 0, removed: 0, failed: 0 }),
				} as const;
				return { getAdapter: async () => adapter };
			});

			const { registerInstallCommand } = await import('../src/commands/install.ts');
			const program = new Command();
			registerInstallCommand(program);
			const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(dir);
			await program.parseAsync(
				['node', 'cli', 'install', '--dry-run', '--scope', 'project', '-c', 'katacut.config.jsonc'],
				{ from: 'node' },
			);
			cwdSpy.mockRestore();

			await expect(stat(join(dir, 'katacut.lock.json'))).rejects.toBeTruthy();
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});

	it('does not modify existing lock on dry-run', async () => {
		const dir = await mkdtemp(join(tmpdir(), 'kc-dryrun-present-'));
		try {
			await writeFile(
				join(dir, 'katacut.config.jsonc'),
				JSON.stringify({
					version: '0.1.0',
					clients: ['claude-code'],
					mcp: { a: { transport: 'http', url: 'https://a' } },
				}),
				'utf8',
			);
			const lockPath = join(dir, 'katacut.lock.json');
			const initial = { version: '1', clients: ['claude-code'], mcpServers: {} };
			await writeFile(lockPath, JSON.stringify(initial, null, 2), 'utf8');

			vi.resetModules();
			vi.doMock('../src/lib/adapters/registry.ts', () => {
				const adapter = {
					id: 'claude-code',
					checkAvailable: async () => true,
					readProject: async () => ({ mcpServers: {} }),
					readUser: async () => ({ mcpServers: {} }),
					desiredFromConfig: () => ({ a: { type: 'http', url: 'https://a' } }),
					applyInstall: async () => ({ added: 1, updated: 0, removed: 0, failed: 0 }),
				} as const;
				return { getAdapter: async () => adapter };
			});

			const { registerInstallCommand } = await import('../src/commands/install.ts');
			const program = new Command();
			registerInstallCommand(program);
			const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(dir);
			await program.parseAsync(
				['node', 'cli', 'install', '--dry-run', '--scope', 'project', '-c', 'katacut.config.jsonc'],
				{ from: 'node' },
			);
			cwdSpy.mockRestore();

			const after = JSON.parse(await readFile(lockPath, 'utf8')) as unknown;
			expect(after).toEqual(initial);
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});
});
