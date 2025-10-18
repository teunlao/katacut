import { mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Command } from 'commander';
import { describe, expect, it, vi } from 'vitest';

describe('kc install: no lock write on failure', () => {
	it('does not write lock when apply fails', async () => {
		const dir = await mkdtemp(join(tmpdir(), 'kc-install-fail-'));
		try {
			const cfg = { version: '0.1.0', mcp: { a: { transport: 'http', url: 'https://a' } } } as const;
			await writeFile(join(dir, 'katacut.config.jsonc'), JSON.stringify(cfg), 'utf8');
			await writeFile(join(dir, '.mcp.json'), JSON.stringify({ mcpServers: {} }), 'utf8');

			vi.resetModules();
			vi.doMock('../src/lib/adapters/registry.ts', () => {
				const adapter = {
					id: 'claude-code',
					checkAvailable: async () => true,
					readProject: async () => ({ mcpServers: {} }),
					readUser: async () => ({ mcpServers: {} }),
					desiredFromConfig: () => ({ a: { type: 'http', url: 'https://a' } }),
					applyInstall: async () => ({ added: 0, updated: 0, removed: 0, failed: 1 }),
				} as const;
				return { getAdapter: async () => adapter };
			});

			const { registerInstallCommand } = await import('../src/commands/install.ts');
			const program = new Command();
			registerInstallCommand(program);
			const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(dir);
			await program.parseAsync(['node', 'cli', 'install', '--client', 'claude-code', '-c', 'katacut.config.jsonc'], {
				from: 'node',
			});
			cwdSpy.mockRestore();

			await expect(stat(join(dir, 'katacut.lock.json'))).rejects.toBeTruthy();
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});
});
