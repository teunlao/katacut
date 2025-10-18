import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Command } from 'commander';
import { describe, expect, it, vi } from 'vitest';

describe('kc mcp add <url>', () => {
	it('adds entry from URL to config and applies plan (project scope)', async () => {
		const dir = await mkdtemp(join(tmpdir(), 'kc-add-url-'));
		try {
			await writeFile(join(dir, 'katacut.config.jsonc'), JSON.stringify({ version: '0.1.0', mcp: {} }), 'utf8');
			await writeFile(join(dir, '.mcp.json'), JSON.stringify({ mcpServers: {} }), 'utf8');

			vi.resetModules();
			// Mock adapter to avoid real CLI calls
			vi.doMock('../../src/lib/adapters/registry.ts', () => {
				const adapter = {
					id: 'claude-code',
					checkAvailable: async () => true,
					readProject: async () => ({ mcpServers: {} }),
					readUser: async () => ({ mcpServers: {} }),
					desiredFromConfig: (c: unknown) => {
						const o = c as {
							mcp: Record<
								string,
								{ transport: string; url?: string; command?: string; args?: string[]; env?: Record<string, string> }
							>;
						};
						const out: Record<
							string,
							{ type: 'http' | 'stdio'; url?: string; command?: string; args?: string[]; env?: Record<string, string> }
						> = {};
						for (const [k, v] of Object.entries(o.mcp))
							out[k] =
								v.transport === 'http'
									? { type: 'http', url: String(v.url ?? '') }
									: { type: 'stdio', command: String(v.command ?? ''), args: v.args, env: v.env };
						return out;
					},
					applyInstall: async (plan: readonly { action: 'add' | 'update' | 'remove'; name: string }[]) => {
						const added = plan.filter((p) => p.action === 'add').length;
						const updated = plan.filter((p) => p.action === 'update').length;
						return { added, updated, removed: 0, failed: 0 };
					},
				} as const;
				return { getAdapter: async () => adapter };
			});

			// Mock fetch
			const descriptor = { type: 'http', url: 'https://api.example.com/mcp', headers: { A: 'b' } } as const;
			const fetchMock = vi.fn(
				async () =>
					new Response(JSON.stringify(descriptor), { status: 200, headers: { 'content-type': 'application/json' } }),
			);
			global.fetch = fetchMock;

			const { registerMcpCommand } = await import('../src/commands/mcp/index.ts');
			const program = new Command();
			registerMcpCommand(program);
			const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(dir);
			await program.parseAsync(['node', 'cli', 'mcp', 'add', 'https://example.com/servers/fs.json'], { from: 'node' });
			cwdSpy.mockRestore();

			// Config updated with derived name "fs"
			const cfg = JSON.parse(await readFile(join(dir, 'katacut.config.jsonc'), 'utf8')) as {
				mcp: Record<string, unknown>;
			};
			expect(Object.keys(cfg.mcp)).toContain('fs');
			// Lock created
			const stLock = await stat(join(dir, 'katacut.lock.json'));
			expect(stLock.isFile()).toBe(true);
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});
});
