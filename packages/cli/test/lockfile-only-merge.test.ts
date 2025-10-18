import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Command } from 'commander';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('kc install --lockfile-only merges with existing entries', () => {
	const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
	beforeEach(() => logSpy.mockClear());
	afterEach(() => logSpy.mockClear());

	it('preserves unrelated entries and their resolvedVersion', async () => {
		const dir = await mkdtemp(join(tmpdir(), 'kc-lock-merge-'));
		try {
			const cfg = { version: '0.1.0', mcp: { a: { transport: 'http', url: 'https://a' } } } as const;
			await writeFile(join(dir, 'katacut.config.jsonc'), JSON.stringify(cfg), 'utf8');
			await writeFile(
				join(dir, '.mcp.json'),
				JSON.stringify({ mcpServers: { a: { type: 'http', url: 'https://a' } } }),
				'utf8',
			);
			// Existing lock has unrelated entry x with resolvedVersion
			const lockExisting = {
				version: '1',
				clients: ['claude-code'],
				mcpServers: {
					x: { scope: 'project', fingerprint: 'fp-x', resolvedVersion: '1.2.3' },
				},
			};
			const lockPath = join(dir, 'katacut.lock.json');
			await writeFile(lockPath, JSON.stringify(lockExisting, null, 2), 'utf8');

			vi.resetModules();
			vi.doMock('../src/lib/adapters/registry.ts', () => {
				const adapter = {
					id: 'claude-code',
					checkAvailable: async () => true,
					readProject: async () => ({ mcpServers: { a: { type: 'http', url: 'https://a' } } }),
					readUser: async () => ({ mcpServers: {} }),
					desiredFromConfig: () => ({ a: { type: 'http', url: 'https://a' } }),
					applyInstall: async () => ({ added: 0, updated: 0, removed: 0, failed: 0 }) as const,
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
					'--lockfile-only',
					'-c',
					'katacut.config.jsonc',
				],
				{ from: 'node' },
			);

			const after = await stat(lockPath);
			expect(after.mtimeMs).toBeGreaterThanOrEqual(before.mtimeMs);
			const text = await readFile(lockPath, 'utf8');
			const parsed = JSON.parse(text) as { mcpServers: Record<string, unknown> };
			expect(Object.keys(parsed.mcpServers).sort()).toEqual(['a', 'x']);
			expect((parsed.mcpServers as Record<string, { resolvedVersion?: string }>).x.resolvedVersion).toBe('1.2.3');
			cwdSpy.mockRestore();
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});
});
