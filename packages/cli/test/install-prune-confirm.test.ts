import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Command } from 'commander';
import { describe, expect, it, vi } from 'vitest';

describe('kc install --prune requires --yes', () => {
	it('refuses prune without --yes', async () => {
		const dir = await mkdtemp(join(tmpdir(), 'kc-prune-'));
		try {
			await writeFile(join(dir, 'katacut.config.jsonc'), JSON.stringify({ version: '0.1.0', mcp: {} }), 'utf8');
			await writeFile(
				join(dir, '.mcp.json'),
				JSON.stringify({ mcpServers: { extra: { type: 'http', url: 'https://x' } } }),
				'utf8',
			);

			vi.resetModules();
			vi.doMock('../src/lib/adapters/registry.ts', () => {
				const adapter = {
					id: 'claude-code',
					checkAvailable: async () => true,
					readProject: async () => ({ mcpServers: { extra: { type: 'http', url: 'https://x' } } }),
					readUser: async () => ({ mcpServers: {} }),
					desiredFromConfig: () => ({}),
					applyInstall: async () => ({ added: 0, updated: 0, removed: 0, failed: 0 }),
				} as const;
				return { getAdapter: async () => adapter };
			});

			const { registerInstallCommand } = await import('../src/commands/install.ts');
			const program = new Command();
			registerInstallCommand(program);
			const logs: string[] = [];
			vi.spyOn(console, 'error').mockImplementation((s: unknown) => {
				if (typeof s === 'string') logs.push(s);
			});
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
					'--prune',
					'-c',
					'katacut.config.jsonc',
				],
				{ from: 'node' },
			);
			cwdSpy.mockRestore();
			expect(logs.some((l) => l.includes('Refusing to prune without confirmation'))).toBe(true);
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});
});
