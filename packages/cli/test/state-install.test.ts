import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Command } from 'commander';
import { describe, expect, it, vi } from 'vitest';

describe('state file after install', () => {
	it('writes .katacut/state.json on success with requested/realized/mode', async () => {
		const dir = await mkdtemp(join(tmpdir(), 'kc-state-'));
		try {
			await writeFile(
				join(dir, 'katacut.config.jsonc'),
				JSON.stringify({ version: '0.1.0', mcp: { a: { transport: 'http', url: 'https://a' } } }),
				'utf8',
			);
			await writeFile(join(dir, '.mcp.json'), JSON.stringify({ mcpServers: {} }), 'utf8');

			vi.resetModules();
			vi.doMock('../src/lib/adapters/registry.ts', () => {
				const adapter = {
					id: 'claude-code',
					checkAvailable: async () => true,
					capabilities: () => ({
						supportsProject: true,
						supportsUser: true,
						emulateProjectWithUser: false,
						supportsGlobalExplicit: false,
					}),
					readProject: async () => ({ mcpServers: {} }),
					readUser: async () => ({ mcpServers: {} }),
					desiredFromConfig: () => ({ a: { type: 'http', url: 'https://a' } }),
					applyInstall: async () => ({ added: 1, updated: 0, removed: 0, failed: 0 }),
				} as const;
				return { getAdapter: async () => adapter };
			});

			const { registerInstallCommand } = await import('../src/commands/install.ts');
			const program = new Command();
			registerInstallCommand(program);
			const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(dir);
			await program.parseAsync(
				['node', 'cli', 'install', '--client', 'claude-code', '--scope', 'project', '-c', 'katacut.config.jsonc'],
				{ from: 'node' },
			);
			cwdSpy.mockRestore();

			const st = await stat(join(dir, '.katacut', 'state.json'));
			expect(st.isFile()).toBe(true);
			const state = JSON.parse(await readFile(join(dir, '.katacut', 'state.json'), 'utf8'));
			expect(state.runs[0].requestedScope).toBe('project');
			expect(state.runs[0].realizedScope).toBe('project');
			expect(state.runs[0].mode).toBe('native');
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});

	it('does not write state on failure', async () => {
		const dir = await mkdtemp(join(tmpdir(), 'kc-state-fail-'));
		try {
			await writeFile(
				join(dir, 'katacut.config.jsonc'),
				JSON.stringify({ version: '0.1.0', mcp: { a: { transport: 'http', url: 'https://a' } } }),
				'utf8',
			);
			await writeFile(join(dir, '.mcp.json'), JSON.stringify({ mcpServers: {} }), 'utf8');

			vi.resetModules();
			vi.doMock('../src/lib/adapters/registry.ts', () => {
				const adapter = {
					id: 'claude-code',
					checkAvailable: async () => true,
					capabilities: () => ({
						supportsProject: true,
						supportsUser: true,
						emulateProjectWithUser: false,
						supportsGlobalExplicit: false,
					}),
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
			await program.parseAsync(
				['node', 'cli', 'install', '--client', 'claude-code', '--scope', 'project', '-c', 'katacut.config.jsonc'],
				{ from: 'node' },
			);
			cwdSpy.mockRestore();

			await expect(stat(join(dir, '.katacut', 'state.json'))).rejects.toBeTruthy();
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});
});
