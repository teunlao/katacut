import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Command } from 'commander';
import { describe, expect, it, vi } from 'vitest';

describe('kc ci reports extras from both scopes', () => {
	it('status mismatch with extras in project and user', async () => {
		const dir = await mkdtemp(join(tmpdir(), 'kc-ci-extras-'));
		try {
			await writeFile(
				join(dir, 'katacut.lock.json'),
				JSON.stringify({ version: '1', clients: ['claude-code'], mcpServers: {} }),
				'utf8',
			);

			vi.resetModules();
			vi.doMock('../src/lib/adapters/registry.ts', () => {
				const adapter = {
					id: 'claude-code',
					checkAvailable: async () => true,
					readProject: async () => ({ mcpServers: { a: { type: 'http', url: 'https://a' } } }),
					readUser: async () => ({ mcpServers: { b: { type: 'http', url: 'https://b' } } }),
				} as const;
				return { getAdapter: async () => adapter };
			});
			const { registerCiCommand } = await import('../src/commands/ci.ts');
			const program = new Command();
			registerCiCommand(program);
			const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(dir);
			await program.parseAsync(['node', 'cli', 'ci', '--client', 'claude-code'], { from: 'node' });
			cwdSpy.mockRestore();
			expect(process.exitCode).toBe(1);
		} finally {
			await rm(dir, { recursive: true, force: true });
			process.exitCode = 0;
		}
	});
});
