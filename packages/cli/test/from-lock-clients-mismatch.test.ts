import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Command } from 'commander';
import { describe, expect, it, vi } from 'vitest';

describe('kc install --from-lock clients mismatch', () => {
	it('exits with code 1 if lock clients differ from selected', async () => {
		const dir = await mkdtemp(join(tmpdir(), 'kc-fromlock-mismatch-'));
		try {
			await writeFile(
				join(dir, 'katacut.config.jsonc'),
				JSON.stringify({
					version: '0.1.0',
					clients: ['gemini-cli'],
					mcp: { a: { transport: 'http', url: 'https://a' } },
				}),
				'utf8',
			);
			const lock = { version: '1', clients: ['claude-code'], mcpServers: {} };
			await writeFile(join(dir, 'katacut.lock.json'), JSON.stringify(lock, null, 2), 'utf8');

			vi.resetModules();
			vi.doMock('../src/lib/adapters/registry.ts', () => {
				const adapter = {
					id: 'gemini-cli',
					checkAvailable: async () => true,
					readProject: async () => ({ mcpServers: {} }),
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
				[
					'node',
					'cli',
					'install',
					'--from-lock',
					'--clients',
					'gemini-cli',
					'--scope',
					'project',
					'-c',
					'katacut.config.jsonc',
				],
				{ from: 'node' },
			);
			cwdSpy.mockRestore();
			// program.parseAsync resolves; install sets exitCode=1 on mismatch
			expect(process.exitCode).toBe(1);
			// ensure lock не изменился
			const content = await readFile(join(dir, 'katacut.lock.json'), 'utf8');
			expect(JSON.parse(content)).toEqual(lock);
		} finally {
			await rm(dir, { recursive: true, force: true });
			process.exitCode = 0;
		}
	});
});
