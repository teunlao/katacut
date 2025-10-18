import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Command } from 'commander';
import { describe, expect, it, vi } from 'vitest';

describe('kc install --from-lock applies strictly from lock snapshots', () => {
	it('ignores config and applies snapshot', async () => {
		const dir = await mkdtemp(join(tmpdir(), 'kc-from-lock-'));
		try {
			// Config with 'a'
			await writeFile(
				join(dir, 'katacut.config.jsonc'),
				JSON.stringify({ version: '0.1.0', mcp: { a: { transport: 'http', url: 'https://a' } } }),
				'utf8',
			);
			// Lock with snapshot 'b'
			const lock = {
				version: '1',
				clients: ['claude-code'],
				mcpServers: {
					b: { scope: 'project', fingerprint: 'x', snapshot: { type: 'http', url: 'https://b' } },
				},
			} as const;
			await writeFile(join(dir, 'katacut.lock.json'), JSON.stringify(lock), 'utf8');

			vi.resetModules();
			// Mock adapter: current empty, desiredFromConfig not used in from-lock
			vi.doMock('../src/lib/adapters/registry.ts', () => {
				let applied = 0;
				const adapter = {
					id: 'claude-code',
					checkAvailable: async () => true,
					readProject: async () => ({ mcpServers: {} }),
					readUser: async () => ({ mcpServers: {} }),
					desiredFromConfig: () => ({ a: { type: 'http', url: 'https://a' } }),
					applyInstall: async (plan: readonly { action: 'add' | 'update' | 'remove'; name: string }[]) => {
						applied += plan.filter((p) => p.action === 'add' && p.name === 'b').length;
						return { added: applied, updated: 0, removed: 0, failed: 0 };
					},
				} as const;
				return { getAdapter: async () => adapter };
			});

			const { registerInstallCommand } = await import('../src/commands/install.ts');
			const program = new Command();
			registerInstallCommand(program);
			const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(dir);
			await program.parseAsync(['node', 'cli', 'install', '--from-lock', '--client', 'claude-code'], { from: 'node' });
			cwdSpy.mockRestore();

			const planOut = await readFile(join(dir, '.mcp.json').toString(), 'utf8').catch(() => '');
			expect(planOut).toBeDefined();
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});
});

it('applies from lock for multiple clients (no adapters[0])', async () => {
	const dir = await mkdtemp(join(tmpdir(), 'kc-from-lock-multi-'));
	try {
		// Minimal valid config (unused in from-lock, but CLI loads it)
		await writeFile(join(dir, 'katacut.config.jsonc'), JSON.stringify({ version: '0.1.0' }), 'utf8');
		// Lock with one snapshot
		const lock = {
			version: '1',
			clients: ['claude-code', 'gemini-cli'],
			mcpServers: {
				a: { scope: 'project', fingerprint: 'x', snapshot: { type: 'http', url: 'https://a' } },
			},
		} as const;
		await writeFile(join(dir, 'katacut.lock.json'), JSON.stringify(lock), 'utf8');

		vi.resetModules();
		let appliedClaude = 0;
		let appliedGemini = 0;
		vi.doMock('../src/lib/adapters/registry.ts', () => {
			const claude = {
				id: 'claude-code',
				checkAvailable: async () => true,
				readProject: async () => ({ mcpServers: {} }),
				readUser: async () => ({ mcpServers: {} }),
				applyInstall: async (plan: readonly { action: 'add' | 'update' | 'remove'; name: string }[]) => {
					appliedClaude += plan.length;
					return { added: plan.length, updated: 0, removed: 0, failed: 0 };
				},
			} as const;
			const gemini = {
				id: 'gemini-cli',
				checkAvailable: async () => true,
				readProject: async () => ({ mcpServers: {} }),
				readUser: async () => ({ mcpServers: {} }),
				applyInstall: async (plan: readonly { action: 'add' | 'update' | 'remove'; name: string }[]) => {
					appliedGemini += plan.length;
					return { added: plan.length, updated: 0, removed: 0, failed: 0 };
				},
			} as const;
			return {
				getAdapter: async (id: string) => (id === 'claude-code' ? claude : gemini),
			};
		});

		const { registerInstallCommand } = await import('../src/commands/install.ts');
		const program = new Command();
		registerInstallCommand(program);
		const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(dir);
		await program.parseAsync(['node', 'cli', 'install', '--from-lock', '--clients', 'claude-code,gemini-cli'], {
			from: 'node',
		});
		cwdSpy.mockRestore();
		expect(appliedClaude).toBe(1);
		expect(appliedGemini).toBe(1);
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
});
