import { mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Command } from 'commander';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('kc install lockfile behavior', () => {
	const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
	beforeEach(() => logSpy.mockClear());
	afterEach(() => logSpy.mockClear());

	it('writes lock by default after apply', async () => {
		const dir = await mkdtemp(join(tmpdir(), 'kc-install-lock-'));
		try {
			const cfg = { version: '0.1.0', mcp: { a: { transport: 'http', url: 'https://a' } } } as const;
			await writeFile(join(dir, 'katacut.config.jsonc'), JSON.stringify(cfg), 'utf8');
			await writeFile(
				join(dir, '.mcp.json'),
				JSON.stringify({ mcpServers: { a: { type: 'http', url: 'https://a' } } }),
				'utf8',
			);

			vi.resetModules();
			vi.doMock('../src/lib/adapters/registry.ts', () => {
				const adapter = {
					id: 'claude-code',
					checkAvailable: async () => true,
					readProject: async () => ({ mcpServers: { a: { type: 'http', url: 'https://a' } } }),
					readUser: async () => ({ mcpServers: {} }),
					desiredFromConfig: () => ({ a: { type: 'http', url: 'https://a' } }),
					applyInstall: async () => ({ added: 0, updated: 0, removed: 0, failed: 0 }),
				} as const;
				return { getAdapter: async () => adapter };
			});

			const { registerInstallCommand } = await import('../src/commands/install.ts');
			const program = new Command();
			registerInstallCommand(program);
			const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(dir);
			await program.parseAsync(
				['node', 'cli', 'install', '--client', 'claude-code', '--scope', 'project', '-c', 'katacut.config.jsonc'],
				{ from: 'node' },
			);
			cwdSpy.mockRestore();

			const st = await stat(join(dir, 'katacut.lock.json'));
			expect(st.isFile()).toBe(true);
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});

	it('respects --no-write-lock and --lockfile-only / --frozen-lock', async () => {
		const dir = await mkdtemp(join(tmpdir(), 'kc-install-lock-2-'));
		try {
			const cfg = { version: '0.1.0', mcp: { a: { transport: 'http', url: 'https://a' } } } as const;
			await writeFile(join(dir, 'katacut.config.jsonc'), JSON.stringify(cfg), 'utf8');
			await writeFile(
				join(dir, '.mcp.json'),
				JSON.stringify({ mcpServers: { a: { type: 'http', url: 'https://a' } } }),
				'utf8',
			);

			let applied = 0;
			vi.resetModules();
			vi.doMock('../src/lib/adapters/registry.ts', () => {
				const adapter = {
					id: 'claude-code',
					checkAvailable: async () => true,
					readProject: async () => ({ mcpServers: { a: { type: 'http', url: 'https://a' } } }),
					readUser: async () => ({ mcpServers: {} }),
					desiredFromConfig: () => ({ a: { type: 'http', url: 'https://a' } }),
					applyInstall: async () => {
						applied++;
						return { added: 0, updated: 0, removed: 0, failed: 0 };
					},
				} as const;
				return { getAdapter: async () => adapter };
			});

			const { registerInstallCommand } = await import('../src/commands/install.ts');
			const program = new Command();
			registerInstallCommand(program);
			const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(dir);

			// no-write-lock: should not create lockfile
			await program.parseAsync(
				[
					'node',
					'cli',
					'install',
					'--client',
					'claude-code',
					'--scope',
					'project',
					'--no-write-lock',
					'-c',
					'katacut.config.jsonc',
				],
				{ from: 'node' },
			);
			await expect(stat(join(dir, 'katacut.lock.json'))).rejects.toBeTruthy();

			// lockfile-only: write lock, do not apply
			applied = 0;
			await program.parseAsync(
				[
					'node',
					'cli',
					'install',
					'--client',
					'claude-code',
					'--scope',
					'project',
					'--lockfile-only',
					'-c',
					'katacut.config.jsonc',
				],
				{ from: 'node' },
			);
			expect(applied).toBe(0);
			const st2 = await stat(join(dir, 'katacut.lock.json'));
			expect(st2.isFile()).toBe(true);

			// frozen-lock mismatch: change config, expect early exit w/o apply
			await writeFile(
				join(dir, 'katacut.config.jsonc'),
				JSON.stringify({ version: '0.1.0', mcp: { b: { transport: 'http', url: 'https://b' } } }),
				'utf8',
			);
			applied = 0;
			await program.parseAsync(
				[
					'node',
					'cli',
					'install',
					'--client',
					'claude-code',
					'--scope',
					'project',
					'--frozen-lock',
					'-c',
					'katacut.config.jsonc',
				],
				{ from: 'node' },
			);
			expect(applied).toBe(0);

			cwdSpy.mockRestore();
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});
});
