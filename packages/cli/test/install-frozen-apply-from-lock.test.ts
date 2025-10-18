import { mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { computeFingerprint } from '@katacut/core';
import { Command } from 'commander';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('kc install --frozen-lock applies from lock when matches', () => {
	const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
	const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
	beforeEach(() => {
		logSpy.mockClear();
		errSpy.mockClear();
	});
	afterEach(() => {
		logSpy.mockClear();
		errSpy.mockClear();
	});

	it('applies add from lock and does not write lockfile', async () => {
		const dir = await mkdtemp(join(tmpdir(), 'kc-install-frozen-'));
		try {
			// Config desires server 'a'
			const cfg = { version: '0.1.0', mcp: { a: { transport: 'http', url: 'https://a' } } } as const;
			await writeFile(join(dir, 'katacut.config.jsonc'), JSON.stringify(cfg), 'utf8');
			// Current state is empty
			await writeFile(join(dir, '.mcp.json'), JSON.stringify({ mcpServers: {} }), 'utf8');
			// Lock contains snapshot for 'a' in project scope
			const snap = { type: 'http', url: 'https://a' } as const;
			const lock = {
				version: '1',
				clients: ['claude-code'],
				mcpServers: {
					a: { scope: 'project', fingerprint: computeFingerprint(snap), snapshot: snap },
				},
			};
			const lockPath = join(dir, 'katacut.lock.json');
			await writeFile(lockPath, JSON.stringify(lock, null, 2), 'utf8');

			let applied = 0;
			vi.resetModules();
			vi.doMock('../src/lib/adapters/registry.ts', () => {
				const adapter = {
					id: 'claude-code',
					checkAvailable: async () => true,
					readProject: async () => ({ mcpServers: {} }),
					readUser: async () => ({ mcpServers: {} }),
					desiredFromConfig: () => ({ a: { type: 'http', url: 'https://a' } }),
					applyInstall: async () => {
						applied++;
						return { added: 1, updated: 0, removed: 0, failed: 0 } as const;
					},
				} as const;
				return { getAdapter: async () => adapter };
			});

			const { registerInstallCommand } = await import('../src/commands/install.ts');
			const program = new Command();
			registerInstallCommand(program);
			const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(dir);

			const before = await stat(lockPath);
			await program.parseAsync(
				[
					'node',
					'cli',
					'install',
					'--client',
					'claude-code',
					'--scope',
					'project',
					'--frozen-lockfile',
					'-c',
					'katacut.config.jsonc',
				],
				{ from: 'node' },
			);
			expect(applied).toBe(1);
			const after = await stat(lockPath);
			// mtimeMs should be unchanged (no write)
			expect(after.mtimeMs).toBe(before.mtimeMs);
			cwdSpy.mockRestore();
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});
});
