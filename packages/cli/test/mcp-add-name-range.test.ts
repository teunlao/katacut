import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Command } from 'commander';
import { describe, expect, it, vi } from 'vitest';

describe('kc mcp add <name>@<range> resolves max satisfying version (npm-like)', () => {
	it('^1.2.3 picks 1.9.0 from available versions', async () => {
		const dir = await mkdtemp(join(tmpdir(), 'kc-add-range-'));
		try {
			await writeFile(join(dir, 'katacut.config.jsonc'), JSON.stringify({ version: '0.1.0', mcp: {} }), 'utf8');
			await writeFile(join(dir, '.mcp.json'), JSON.stringify({ mcpServers: {} }), 'utf8');

			vi.resetModules();
			vi.doMock('../src/lib/adapters/registry.ts', () => {
				const adapter = {
					id: 'claude-code',
					checkAvailable: async () => true,
					readProject: async () => ({ mcpServers: {} }),
					readUser: async () => ({ mcpServers: {} }),
					desiredFromConfig: (c: unknown) => {
						const o = c as {
							mcp: Record<string, { transport: string; url?: string; command?: string; args?: string[] }>;
						};
						const out: Record<
							string,
							{ type: 'http'; url: string } | { type: 'stdio'; command: string; args?: string[] }
						> = {};
						for (const [k, v] of Object.entries(o.mcp))
							out[k] =
								v.transport === 'http'
									? { type: 'http', url: v.url }
									: { type: 'stdio', command: v.command, args: v.args };
						return out;
					},
					applyInstall: async () => ({ added: 1, updated: 0, removed: 0, failed: 0 }),
				} as const;
				return { getAdapter: async () => adapter };
			});

			const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
				const url = String(input);
				if (url.includes('/servers?search=com.example%2Fmy-server')) {
					const payload = {
						servers: [
							{ server: { name: 'com.example/my-server', version: '1.2.3' } },
							{ server: { name: 'com.example/my-server', version: '1.5.0' } },
							{ server: { name: 'com.example/my-server', version: '1.9.0' } },
							{ server: { name: 'com.example/my-server', version: '2.0.0' } },
						],
					} as const;
					return new Response(JSON.stringify(payload), {
						status: 200,
						headers: { 'content-type': 'application/json' },
					});
				}
				if (url.includes('/servers/com.example%2Fmy-server/versions/1.9.0')) {
					const payload = {
						server: { name: 'com.example/my-server', remotes: [{ type: 'http', url: 'https://example/mcp' }] },
					} as const;
					return new Response(JSON.stringify(payload), {
						status: 200,
						headers: { 'content-type': 'application/json' },
					});
				}
				return new Response('not found', { status: 404 });
			});
			// @ts-expect-error
			global.fetch = fetchMock;

			const { registerMcpCommand } = await import('../src/commands/mcp/index.ts');
			const program = new Command();
			registerMcpCommand(program);
			const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(dir);
			await program.parseAsync(['node', 'cli', 'mcp', 'add', 'com.example/my-server@^1.2.3'], { from: 'node' });
			cwdSpy.mockRestore();

			const lock = JSON.parse(await readFile(join(dir, 'katacut.lock.json'), 'utf8')) as {
				mcpServers: Record<string, { resolvedVersion?: string }>;
			};
			expect(lock.mcpServers['my-server'].resolvedVersion).toBe('1.9.0');
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});
});
