import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Command } from 'commander';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('kc install --from-lock with missing snapshot', () => {
	const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
	beforeEach(() => errSpy.mockClear());
	afterEach(() => {
		errSpy.mockClear();
		(process as unknown as { exitCode?: number | null }).exitCode = 0;
	});

	it('fails with exit code 1', async () => {
		const dir = await mkdtemp(join(tmpdir(), 'kc-fromlock-missing-'));
		try {
			// Config can be anything, ignored by --from-lock
			await writeFile(join(dir, 'katacut.config.jsonc'), JSON.stringify({ version: '0.1.0', mcp: {} }), 'utf8');
			await writeFile(join(dir, '.mcp.json'), JSON.stringify({ mcpServers: {} }), 'utf8');
			// Lock has entry without snapshot
			const lock = {
				version: '1',
				clients: ['claude-code'],
				mcpServers: {
					bad: { scope: 'project', fingerprint: 'whatever' },
				},
			};
			await writeFile(join(dir, 'katacut.lock.json'), JSON.stringify(lock, null, 2), 'utf8');

			vi.resetModules();
			vi.doMock('../src/lib/adapters/registry.ts', () => {
				const adapter = {
					id: 'claude-code',
					checkAvailable: async () => true,
					readProject: async () => ({ mcpServers: {} }),
					readUser: async () => ({ mcpServers: {} }),
					desiredFromConfig: () => ({}) as Record<string, never>,
					applyInstall: async () => ({ added: 0, updated: 0, removed: 0, failed: 0 }) as const,
				} as const;
				return { getAdapter: async () => adapter };
			});

			const { registerInstallCommand } = await import('../src/commands/install.ts');
			const program = new Command();
			registerInstallCommand(program);
			const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(dir);

			await program.parseAsync(
				[
					'node',
					'cli',
					'install',
					'--client',
					'claude-code',
					'--scope',
					'project',
					'--from-lock',
					'-c',
					'katacut.config.jsonc',
				],
				{ from: 'node' },
			);

			expect(process.exitCode).toBe(1);
			cwdSpy.mockRestore();
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});
});
