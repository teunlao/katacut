import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildLock } from '@katacut/core';
import { Command } from 'commander';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('kc install lockfile behavior', () => {
	const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
	beforeEach(() => logSpy.mockClear());
	afterEach(() => logSpy.mockClear());

	it('writes lock by default after apply', async () => {
		const dir = await mkdtemp(join(tmpdir(), 'kc-install-lock-'));
		try {
			const cfg = { version: '0.1.0', mcp: { a: { transport: 'http', url: 'https://a' } } } as const;
			await writeFile(join(dir, 'katacut.config.jsonc'), JSON.stringify(cfg), 'utf8');
			await writeFile(
				join(dir, '.mcp.json'),
				JSON.stringify({ mcpServers: { a: { type: 'http', url: 'https://a' } } }),
				'utf8',
			);

			vi.resetModules();
			vi.doMock('../src/lib/adapters/registry.ts', () => {
				const adapter = {
					id: 'claude-code',
					checkAvailable: async () => true,
					readProject: async () => ({ mcpServers: { a: { type: 'http', url: 'https://a' } } }),
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
				['node', 'cli', 'install', '--client', 'claude-code', '--scope', 'project', '-c', 'katacut.config.jsonc'],
				{ from: 'node' },
			);
			cwdSpy.mockRestore();

			const st = await stat(join(dir, 'katacut.lock.json'));
			expect(st.isFile()).toBe(true);
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});

	it('writes clean snapshot (no merge) after apply', async () => {
		const dir = await mkdtemp(join(tmpdir(), 'kc-install-lock-clean-'));
		try {
			const cfg = { version: '0.1.0', mcp: { a: { transport: 'http', url: 'https://a' } } } as const;
			await writeFile(join(dir, 'katacut.config.jsonc'), JSON.stringify(cfg), 'utf8');
			await writeFile(
				join(dir, '.mcp.json'),
				JSON.stringify({ mcpServers: { a: { type: 'http', url: 'https://a' } } }),
				'utf8',
			);
			// Prepare existing lock with unrelated entry 'x'
			const existing = {
				version: '1',
				clients: ['claude-code'],
				mcpServers: { x: { scope: 'project', fingerprint: 'fp-x', resolvedVersion: '9.9.9' } },
			};
			await writeFile(join(dir, 'katacut.lock.json'), JSON.stringify(existing, null, 2), 'utf8');

			vi.resetModules();
			vi.doMock('../src/lib/adapters/registry.ts', () => {
				const adapter = {
					id: 'claude-code',
					checkAvailable: async () => true,
					readProject: async () => ({ mcpServers: { a: { type: 'http', url: 'https://a' } } }),
					readUser: async () => ({ mcpServers: {} }),
					applyInstall: async () => ({ added: 0, updated: 0, removed: 0, failed: 0 }),
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

			const text = await readFile(join(dir, 'katacut.lock.json'), 'utf8');
			const parsed = JSON.parse(text) as { mcpServers: Record<string, unknown> };
			expect(Object.keys(parsed.mcpServers)).toEqual(['a']);
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});

	it('writes clean snapshot for multiple clients after apply', async () => {
		const dir = await mkdtemp(join(tmpdir(), 'kc-install-lock-clean-multi-'));
		try {
			const cfg = {
				version: '0.1.0',
				clients: ['claude-code', 'gemini-cli'],
				mcp: { a: { transport: 'http', url: 'https://a' } },
			} as const;
			await writeFile(join(dir, 'katacut.config.jsonc'), JSON.stringify(cfg), 'utf8');
			await writeFile(
				join(dir, '.mcp.json'),
				JSON.stringify({ mcpServers: { a: { type: 'http', url: 'https://a' } } }),
				'utf8',
			);
			// Existing lock has unrelated entry and wrong clients
			const existing = {
				version: '1',
				clients: ['some-other'],
				mcpServers: { x: { scope: 'project', fingerprint: 'fp-x', resolvedVersion: '0.0.1' } },
			};
			await writeFile(join(dir, 'katacut.lock.json'), JSON.stringify(existing, null, 2), 'utf8');

			vi.resetModules();
			vi.doMock('../src/lib/adapters/registry.ts', () => {
				const claude = {
					id: 'claude-code',
					checkAvailable: async () => true,
					readProject: async () => ({ mcpServers: { a: { type: 'http', url: 'https://a' } } }),
					readUser: async () => ({ mcpServers: {} }),
					applyInstall: async () => ({ added: 0, updated: 0, removed: 0, failed: 0 }),
				} as const;
				const gemini = {
					id: 'gemini-cli',
					checkAvailable: async () => true,
					readProject: async () => ({ mcpServers: { a: { type: 'http', url: 'https://a' } } }),
					readUser: async () => ({ mcpServers: {} }),
					applyInstall: async () => ({ added: 0, updated: 0, removed: 0, failed: 0 }),
				} as const;
				return { getAdapter: async (id: string) => (id === 'claude-code' ? claude : gemini) };
			});

			const { registerInstallCommand } = await import('../src/commands/install.ts');
			const program = new Command();
			registerInstallCommand(program);
			const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(dir);
			await program.parseAsync(['node', 'cli', 'install'], { from: 'node' });
			cwdSpy.mockRestore();

			const text = await readFile(join(dir, 'katacut.lock.json'), 'utf8');
			const parsed = JSON.parse(text) as { clients?: string[]; mcpServers: Record<string, unknown> };
			expect(parsed.clients).toEqual(['claude-code', 'gemini-cli']);
			expect(Object.keys(parsed.mcpServers)).toEqual(['a']);
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});

it('respects --no-write-lock and --lockfile-only / --frozen-lockfile', async () => {
		const dir = await mkdtemp(join(tmpdir(), 'kc-install-lock-2-'));
		try {
			const cfg = { version: '0.1.0', mcp: { a: { transport: 'http', url: 'https://a' } } } as const;
			await writeFile(join(dir, 'katacut.config.jsonc'), JSON.stringify(cfg), 'utf8');
			await writeFile(
				join(dir, '.mcp.json'),
				JSON.stringify({ mcpServers: { a: { type: 'http', url: 'https://a' } } }),
				'utf8',
			);

			let applied = 0;
			vi.resetModules();
			vi.doMock('../src/lib/adapters/registry.ts', () => {
				const adapter = {
					id: 'claude-code',
					checkAvailable: async () => true,
					readProject: async () => ({ mcpServers: { a: { type: 'http', url: 'https://a' } } }),
					readUser: async () => ({ mcpServers: {} }),
					desiredFromConfig: () => ({ a: { type: 'http', url: 'https://a' } }),
					applyInstall: async () => {
						applied++;
						return { added: 0, updated: 0, removed: 0, failed: 0 };
					},
				} as const;
				return { getAdapter: async () => adapter };
			});

			const { registerInstallCommand } = await import('../src/commands/install.ts');
			const program = new Command();
			registerInstallCommand(program);
			const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(dir);

			// no-write-lock: should not create lockfile
			await program.parseAsync(
				[
					'node',
					'cli',
					'install',
					'--client',
					'claude-code',
					'--scope',
					'project',
					'--no-write-lock',
					'-c',
					'katacut.config.jsonc',
				],
				{ from: 'node' },
			);
			await expect(stat(join(dir, 'katacut.lock.json'))).rejects.toBeTruthy();

			// lockfile-only: write lock, do not apply
			applied = 0;
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
			expect(applied).toBe(0);
			const st2 = await stat(join(dir, 'katacut.lock.json'));
			expect(st2.isFile()).toBe(true);

            // frozen-lockfile mismatch: change config, expect early exit w/o apply
			await writeFile(
				join(dir, 'katacut.config.jsonc'),
				JSON.stringify({ version: '0.1.0', mcp: { b: { transport: 'http', url: 'https://b' } } }),
				'utf8',
			);
			applied = 0;
			await program.parseAsync(
				[
					'node',
					'cli',
					'install',
					'--client',
					'claude-code',
					'--scope',
					'project',
                    '--frozen-lockfile',
					'-c',
					'katacut.config.jsonc',
				],
				{ from: 'node' },
			);
			expect(applied).toBe(0);

			cwdSpy.mockRestore();
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});

	it('frozen-lock on multiple clients applies from lock for each client and does not write lock', async () => {
		const dir = await mkdtemp(join(tmpdir(), 'kc-install-frozen-multi-'));
		try {
			const cfg = {
				version: '0.1.0',
				clients: ['claude-code', 'gemini-cli'],
				mcp: { a: { transport: 'http', url: 'https://a' } },
			} as const;
			await writeFile(join(dir, 'katacut.config.jsonc'), JSON.stringify(cfg), 'utf8');
			// Prepare matching lock
			const desired = { a: { type: 'http' as const, url: 'https://a' } };
			const lock = buildLock(['claude-code', 'gemini-cli'], desired, 'project');
			const lockPath = join(dir, 'katacut.lock.json');
			await writeFile(lockPath, JSON.stringify(lock, null, 2), 'utf8');

			let calledClaude = 0;
			let calledGemini = 0;
			vi.resetModules();
			vi.doMock('../src/lib/adapters/registry.ts', () => {
				const claude = {
					id: 'claude-code',
					checkAvailable: async () => true,
					readProject: async () => ({ mcpServers: {} }),
					readUser: async () => ({ mcpServers: {} }),
					applyInstall: async (plan: readonly { action: 'add' | 'update' | 'remove'; name: string }[]) => {
						calledClaude += plan.length;
						return { added: plan.length, updated: 0, removed: 0, failed: 0 };
					},
				} as const;
				const gemini = {
					id: 'gemini-cli',
					checkAvailable: async () => true,
					readProject: async () => ({ mcpServers: {} }),
					readUser: async () => ({ mcpServers: {} }),
					applyInstall: async (plan: readonly { action: 'add' | 'update' | 'remove'; name: string }[]) => {
						calledGemini += plan.length;
						return { added: plan.length, updated: 0, removed: 0, failed: 0 };
					},
				} as const;
				return { getAdapter: async (id: string) => (id === 'claude-code' ? claude : gemini) };
			});

			const { registerInstallCommand } = await import('../src/commands/install.ts');
			const program = new Command();
			registerInstallCommand(program);
			const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(dir);
			const before = await stat(lockPath);
			await program.parseAsync(['node', 'cli', 'install', '--frozen-lockfile'], { from: 'node' });
			cwdSpy.mockRestore();
			// Both clients applied from lock
			expect(calledClaude).toBeGreaterThan(0);
			expect(calledGemini).toBeGreaterThan(0);
			// Lock not modified
			const after = await stat(lockPath);
			expect(after.mtimeMs).toBe(before.mtimeMs);
			// Plan printed twice
			const text = await readFile(lockPath, 'utf8');
			expect(JSON.parse(text).clients).toEqual(['claude-code', 'gemini-cli']);
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});

	it('frozen-lock --dry-run on multiple clients prints plans and does not apply', async () => {
		const dir = await mkdtemp(join(tmpdir(), 'kc-install-frozen-dry-multi-'));
		try {
			const cfg = {
				version: '0.1.0',
				clients: ['claude-code', 'gemini-cli'],
				mcp: { a: { transport: 'http', url: 'https://a' } },
			} as const;
			await writeFile(join(dir, 'katacut.config.jsonc'), JSON.stringify(cfg), 'utf8');
			const desired = { a: { type: 'http' as const, url: 'https://a' } };
			const lock = buildLock(['claude-code', 'gemini-cli'], desired, 'project');
			const lockPath = join(dir, 'katacut.lock.json');
			await writeFile(lockPath, JSON.stringify(lock, null, 2), 'utf8');

			let appliedClaude = 0;
			let appliedGemini = 0;
			const logs: string[] = [];
			vi.resetModules();
			vi.doMock('../src/lib/adapters/registry.ts', () => {
				const claude = {
					id: 'claude-code',
					checkAvailable: async () => true,
					readProject: async () => ({ mcpServers: {} }), // so plan has ADD
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
				return { getAdapter: async (id: string) => (id === 'claude-code' ? claude : gemini) };
			});

			const { registerInstallCommand } = await import('../src/commands/install.ts');
			const program = new Command();
			registerInstallCommand(program);
			const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(dir);
			const logSpy = vi.spyOn(console, 'log').mockImplementation((s: unknown) => {
				if (typeof s === 'string') logs.push(s);
			});
			await program.parseAsync(['node', 'cli', 'install', '--frozen-lockfile', '--dry-run'], { from: 'node' });
			cwdSpy.mockRestore();
			logSpy.mockRestore();
			// Nothing applied in dry-run
			expect(appliedClaude).toBe(0);
			expect(appliedGemini).toBe(0);
			// Two plan JSON arrays printed (one per client)
			const plans = logs.filter((l) => l.trim().startsWith('['));
			expect(plans.length).toBeGreaterThanOrEqual(2);
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});
});
