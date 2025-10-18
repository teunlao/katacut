import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Command } from 'commander';
import { describe, expect, it, vi } from 'vitest';

describe('kc mcp add <name>@<short-version> normalizes to full semver in registry URL', () => {
	it('requests /versions/5.4.0 when user passes @5.4', async () => {
		const dir = await mkdtemp(join(tmpdir(), 'kc-add-name-vernorm-'));
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
					desiredFromConfig: () => ({}),
					applyInstall: async () => ({ added: 0, updated: 0, removed: 0, failed: 0 }),
				} as const;
				return { getAdapter: async () => adapter };
			});

			const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
				const url = String(input);
				if (url.includes('/servers?search=com.example%2Fmy-server')) {
					const payload = { servers: [{ server: { name: 'com.example/my-server', version: '5.4.0' } }] } as const;
					return new Response(JSON.stringify(payload), {
						status: 200,
						headers: { 'content-type': 'application/json' },
					});
				}
				if (url.includes('/servers/com.example%2Fmy-server/versions/5.4.0')) {
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
			// @ts-expect-error assign global
			global.fetch = fetchMock;

			const { registerMcpCommand } = await import('../src/commands/mcp/index.ts');
			const program = new Command();
			registerMcpCommand(program);
			const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(dir);
			await program.parseAsync(['node', 'cli', 'mcp', 'add', 'com.example/my-server@5.4'], { from: 'node' });
			cwdSpy.mockRestore();

			const called = fetchMock.mock.calls.some((c) => String(c[0]).includes('/versions/5.4.0'));
			expect(called).toBe(true);
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});
});
