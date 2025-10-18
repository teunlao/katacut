import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Command } from 'commander';
import { describe, expect, it, vi } from 'vitest';

describe('kc ci', () => {
	it('returns ok for matching lock and state, mismatch otherwise', async () => {
		const dir = await mkdtemp(join(tmpdir(), 'kc-ci-'));
		try {
			await writeFile(
				join(dir, '.mcp.json'),
				JSON.stringify({ mcpServers: { x: { type: 'http', url: 'https://x' } } }),
				'utf8',
			);
			const lock = {
				version: '1',
				clients: ['claude-code'],
				mcpServers: { x: { scope: 'project', fingerprint: '' } },
			} as const;

			vi.resetModules();
			vi.doMock('@katacut/core', async (orig) => {
				const mod = await orig();
				return {
					...mod,
					verifyLock: (_l: unknown, project: { mcpServers: Record<string, unknown> }) => {
						// Consider mismatch when project has no 'x'
						const ok = Object.hasOwn(project.mcpServers, 'x');
						return {
							clients: ['claude-code'],
							status: ok ? 'ok' : 'mismatch',
							mismatches: ok ? [] : [{ name: 'x', reason: 'missing' }],
						};
					},
				};
			});
			vi.doMock('../src/lib/adapters/registry.ts', () => {
				const adapter = {
					id: 'claude-code',
					readProject: async () => ({ mcpServers: { x: { type: 'http', url: 'https://x' } } }),
					readUser: async () => ({ mcpServers: {} }),
				} as const;
				return { getAdapter: async () => adapter };
			});

			const { registerCiCommand } = await import('../src/commands/ci.ts');
			const program = new Command();
			registerCiCommand(program);
			const logs: string[] = [];
			vi.spyOn(console, 'log').mockImplementation((s: unknown) => {
				if (typeof s === 'string') logs.push(s);
			});
			const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(dir);

			// ok
			await writeFile(join(dir, 'katacut.lock.json'), JSON.stringify(lock), 'utf8');
			await program.parseAsync(['node', 'cli', 'ci', '--client', 'claude-code'], { from: 'node' });
			const okReport = JSON.parse(logs.pop() ?? '{}');
			expect(okReport.status).toBe('ok');

			// mismatch (simulate by removing entry from project via mock override)
			vi.resetModules();
			vi.doMock('@katacut/core', async (orig) => {
				const mod = await orig();
				return {
					...mod,
					verifyLock: (_l: unknown, project: { mcpServers: Record<string, unknown> }) => {
						const ok = Object.hasOwn(project.mcpServers, 'x');
						return {
							clients: ['claude-code'],
							status: ok ? 'ok' : 'mismatch',
							mismatches: ok ? [] : [{ name: 'x', reason: 'missing' }],
						};
					},
				};
			});
			vi.doMock('../src/lib/adapters/registry.ts', () => {
				const adapter = {
					id: 'claude-code',
					readProject: async () => ({ mcpServers: {} }),
					readUser: async () => ({ mcpServers: {} }),
				} as const;
				return { getAdapter: async () => adapter };
			});
			const { registerCiCommand: reg2 } = await import('../src/commands/ci.ts');
			const program2 = new Command();
			reg2(program2);
			logs.length = 0;
			await program2.parseAsync(['node', 'cli', 'ci', '--client', 'claude-code'], { from: 'node' });
			const mismatchReport = JSON.parse(logs.pop() ?? '{}');
			expect(mismatchReport.status).toBe('mismatch');

			cwdSpy.mockRestore();
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});
});
