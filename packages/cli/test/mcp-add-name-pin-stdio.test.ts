import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Command } from 'commander';
import { describe, expect, it, vi } from 'vitest';

describe('kc mcp add <name>@<version> pins npm version in stdio args', () => {
	it('adds @version to identifier for npx when version is concrete', async () => {
		const dir = await mkdtemp(join(tmpdir(), 'kc-add-pin-'));
		try {
			await writeFile(join(dir, 'katacut.config.jsonc'), JSON.stringify({ version: '0.1.0', mcp: {} }), 'utf8');
			await writeFile(join(dir, '.mcp.json'), JSON.stringify({ mcpServers: {} }), 'utf8');

			vi.resetModules();
			// Mock adapter
			vi.doMock('../src/lib/adapters/registry.ts', () => {
				const adapter = {
					id: 'claude-code',
					checkAvailable: async () => true,
					readProject: async () => ({ mcpServers: {} }),
					readUser: async () => ({ mcpServers: {} }),
					desiredFromConfig: (c: unknown) => {
						const cfg = c as { mcp: Record<string, { transport: string; command: string; args: string[] }> };
						const result: Record<string, { type: 'stdio'; command: string; args: string[] }> = {};
						for (const [k, v] of Object.entries(cfg.mcp)) {
							result[k] = { type: 'stdio', command: v.command, args: v.args };
						}
						return result;
					},
					applyInstall: async () => ({ added: 1, updated: 0, removed: 0, failed: 0 }),
				} as const;
				return { getAdapter: async () => adapter };
			});

			// Mock fetch for registry version URL: returns stdio with npm package
			const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
				const url = String(input);
				if (url.includes('/servers/com.example%2Fpkg/versions/1.2.3')) {
					const payload = {
						server: {
							name: 'com.example/pkg',
							packages: [
								{ registryType: 'npm', transport: { type: 'stdio' }, identifier: '@scope/pkg', version: '1.2.3' },
							],
						},
					} as const;
					return new Response(JSON.stringify(payload), {
						status: 200,
						headers: { 'content-type': 'application/json' },
					});
				}
				return new Response('not found', { status: 404 });
			});
			global.fetch = fetchMock;

			const { registerMcpCommand } = await import('../src/commands/mcp/index.ts');
			const program = new Command();
			registerMcpCommand(program);
			const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(dir);
			await program.parseAsync(['node', 'cli', 'mcp', 'add', 'com.example/pkg@1.2.3', '--save-exact'], {
				from: 'node',
			});
			cwdSpy.mockRestore();

			const cfg = JSON.parse(await readFile(join(dir, 'katacut.config.jsonc'), 'utf8')) as {
				mcp: Record<string, { transport: string; command: string; args: string[] }>;
			};
			const entry = cfg.mcp.pkg;
			expect(entry.transport).toBe('stdio');
			expect(entry.command).toBe('npx');
			expect(entry.args[1]).toContain('@1.2.3');
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});
});
