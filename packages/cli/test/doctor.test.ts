import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Command } from 'commander';
import { describe, expect, it, vi } from 'vitest';

describe('kc doctor', () => {
	it('reports ok when CLI available, paths writable and no conflicts', async () => {
		vi.resetModules();
		const dir = await mkdtemp(join(tmpdir(), 'kc-doctor-ok-'));
		try {
			await mkdir(dir, { recursive: true });
			await writeFile(
				join(dir, '.mcp.json'),
				JSON.stringify({ mcpServers: { a: { type: 'http', url: 'https://a' } } }),
				'utf8',
			);

			vi.doMock('../src/lib/adapters/registry.ts', () => {
				const adapter = {
					id: 'claude-code',
					capabilities: () => ({
						supportsProject: true,
						supportsUser: true,
						emulateProjectWithUser: false,
						supportsGlobalExplicit: false,
					}),
					checkAvailable: async () => true,
					readProject: async () => ({ mcpServers: { a: { type: 'http', url: 'https://a' } } }),
					readUser: async () => ({
						source: join(dir, 'user.json'),
						mcpServers: { b: { type: 'stdio', command: 'echo' } },
					}),
				} as const;
				return { getAdapter: async () => adapter };
			});
			await writeFile(
				join(dir, 'user.json'),
				JSON.stringify({ mcpServers: { b: { type: 'stdio', command: 'echo' } } }),
				'utf8',
			);

			const { registerDoctorCommand } = await import('../src/commands/doctor.ts');
			const program = new Command();
			registerDoctorCommand(program);
			const logs: string[] = [];
			const spy = vi.spyOn(console, 'log').mockImplementation((s: unknown) => {
				if (typeof s === 'string') logs.push(s);
			});
			const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(dir);
			await program.parseAsync(['node', 'cli', 'doctor', '--client', 'claude-code'], { from: 'node' });
			cwdSpy.mockRestore();
			spy.mockRestore();
			const payload = JSON.parse(logs[0] ?? '{}');
			expect(['ok', 'warn']).toContain(payload.status);
			expect(payload.client).toBe('claude-code');
			expect(payload.conflicts).toEqual([]);
			expect(payload.project.readable).toBeTypeOf('boolean');
			expect(payload.project.writable).toBeTypeOf('boolean');
			expect(payload.capabilities.supportsProject).toBe(true);
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});

	it('reports error when CLI missing (and shows summary)', async () => {
		vi.resetModules();
		const dir = await mkdtemp(join(tmpdir(), 'kc-doctor-warn-'));
		try {
			await writeFile(
				join(dir, '.mcp.json'),
				JSON.stringify({ mcpServers: { c: { type: 'http', url: 'https://proj' } } }),
				'utf8',
			);
			const userPath = join(dir, 'user.json');
			await writeFile(userPath, JSON.stringify({ mcpServers: { c: { type: 'http', url: 'https://user' } } }), 'utf8');
			await chmod(userPath, 0o444);

			vi.doMock('../src/lib/adapters/registry.ts', () => {
				const adapter = {
					id: 'claude-code',
					capabilities: () => ({
						supportsProject: true,
						supportsUser: true,
						emulateProjectWithUser: false,
						supportsGlobalExplicit: false,
					}),
					checkAvailable: async () => false,
					readProject: async () => ({ mcpServers: { c: { type: 'http', url: 'https://proj' } } }),
					readUser: async () => ({ source: userPath, mcpServers: { c: { type: 'http', url: 'https://user' } } }),
				} as const;
				return { getAdapter: async () => adapter };
			});

			const { registerDoctorCommand } = await import('../src/commands/doctor.ts');
			const program = new Command();
			registerDoctorCommand(program);
			const logs: string[] = [];
			const spy = vi.spyOn(console, 'log').mockImplementation((s: unknown) => {
				if (typeof s === 'string') logs.push(s);
			});
			const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(dir);
			await program.parseAsync(['node', 'cli', 'doctor'], { from: 'node' });
			cwdSpy.mockRestore();
			spy.mockRestore();
			const payload = JSON.parse(logs[0] ?? '{}');
			expect(payload.cli.available).toBe(false);
			expect(payload.status).toBe('error');
			expect(Array.isArray(payload.conflicts)).toBe(true);
			expect(logs.some((l) => typeof l === 'string' && String(l).includes('Doctor Summary:'))).toBe(true);
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});

	it('per-client statuses differ across clients (aggregation scenario)', async () => {
		vi.resetModules();
		const dir = await mkdtemp(join(tmpdir(), 'kc-doctor-multi-'));
		try {
			// Ensure default project path exists for readable/writable
			await writeFile(join(dir, '.mcp.json'), JSON.stringify({ mcpServers: {} }), 'utf8');
			vi.doMock('../src/lib/adapters/registry.ts', () => {
				const claude = {
					id: 'claude-code',
					checkAvailable: async () => false, // error status for claude
					readProject: async () => ({ mcpServers: {} }),
					readUser: async () => ({ mcpServers: {} }),
				} as const;
				const gemini = {
					id: 'gemini-cli',
					checkAvailable: async () => true, // ok status for gemini
					readProject: async () => ({ source: join(dir, '.mcp.json'), mcpServers: {} }),
					readUser: async () => ({ mcpServers: {} }),
				} as const;
				return { getAdapter: async (id: string) => (id === 'claude-code' ? claude : gemini) };
			});

			const { registerDoctorCommand } = await import('../src/commands/doctor.ts');
			const program = new Command();
			registerDoctorCommand(program);
			const logs: string[] = [];
			const spy = vi.spyOn(console, 'log').mockImplementation((s: unknown) => {
				if (typeof s === 'string') logs.push(s);
			});
			const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(dir);
			await program.parseAsync(['node', 'cli', 'doctor', '--client', 'claude-code', '--json'], { from: 'node' });
			await program.parseAsync(['node', 'cli', 'doctor', '--client', 'gemini-cli', '--json'], { from: 'node' });
			cwdSpy.mockRestore();
			spy.mockRestore();
			const reportClaude = JSON.parse(logs[0] ?? '{}');
			const reportGemini = JSON.parse(logs[1] ?? '{}');
			expect(reportClaude.client).toBe('claude-code');
			expect(reportGemini.client).toBe('gemini-cli');
			expect(reportClaude.status).toBe('error');
			expect(['ok', 'warn']).toContain(reportGemini.status);
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});

	it('reports conflicts and lock mismatch for selected client', async () => {
		vi.resetModules();
		const dir = await mkdtemp(join(tmpdir(), 'kc-doctor-conflict-'));
		try {
			// Project and user with conflicting entry 'a'
			await writeFile(
				join(dir, '.mcp.json'),
				JSON.stringify({ mcpServers: { a: { type: 'http', url: 'https://proj' } } }),
				'utf8',
			);
			const userPath = join(dir, 'user.json');
			await writeFile(userPath, JSON.stringify({ mcpServers: { a: { type: 'http', url: 'https://user' } } }), 'utf8');
			// Lock expects entry 'c' (missing in both scopes)
			await writeFile(
				join(dir, 'katacut.lock.json'),
				JSON.stringify({
					version: '1',
					clients: ['claude-code'],
					mcpServers: { c: { scope: 'project', fingerprint: 'deadbeef' } },
				}),
				'utf8',
			);

			vi.doMock('../src/lib/adapters/registry.ts', () => {
				const adapter = {
					id: 'claude-code',
					checkAvailable: async () => true,
					readProject: async () => ({
						source: join(dir, '.mcp.json'),
						mcpServers: { a: { type: 'http', url: 'https://proj' } },
					}),
					readUser: async () => ({ source: userPath, mcpServers: { a: { type: 'http', url: 'https://user' } } }),
				} as const;
				return { getAdapter: async () => adapter };
			});

			const { registerDoctorCommand } = await import('../src/commands/doctor.ts');
			const program = new Command();
			registerDoctorCommand(program);
			const logs: string[] = [];
			const spy = vi.spyOn(console, 'log').mockImplementation((s: unknown) => {
				if (typeof s === 'string') logs.push(s);
			});
			const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(dir);
			await program.parseAsync(['node', 'cli', 'doctor', '--client', 'claude-code', '--json'], { from: 'node' });
			cwdSpy.mockRestore();
			spy.mockRestore();
			const report = JSON.parse(logs[0] ?? '{}');
			expect(report.client).toBe('claude-code');
			expect(Array.isArray(report.conflicts)).toBe(true);
			expect(report.conflicts.includes('a')).toBe(true);
			expect(report.lock.status).toBe('mismatch');
			expect(
				report.lock.mismatches.some((m: { name: string; reason: string }) => m.name === 'c' && m.reason === 'missing'),
			).toBe(true);
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});
});

describe('doctor local overrides', () => {
	it('classifies last local run as localOverrides (ok)', async () => {
		vi.resetModules();
		const dir = await mkdtemp(join(tmpdir(), 'kc-doctor-local-'));
		try {
			await mkdir(join(dir, '.katacut'), { recursive: true });
			await writeFile(
				join(dir, '.katacut', 'state.json'),
				JSON.stringify({
					version: '1',
					runs: [
						{
							at: new Date().toISOString(),
							clients: ['claude-code'],
							requestedScope: 'project',
							realizedScope: 'project',
							mode: 'native',
							intent: 'local',
							result: { added: 0, updated: 0, removed: 1, failed: 0 },
							entries: { x: { scope: 'project', outcome: 'remove' } },
						},
					],
				}),
				'utf8',
			);

			vi.doMock('../src/lib/adapters/registry.ts', () => {
				const adapter = {
					id: 'claude-code',
					capabilities: () => ({
						supportsProject: true,
						supportsUser: true,
						emulateProjectWithUser: false,
						supportsGlobalExplicit: false,
					}),
					checkAvailable: async () => true,
					readProject: async () => ({ mcpServers: {} }),
					readUser: async () => ({ mcpServers: {} }),
				} as const;
				return { getAdapter: async () => adapter };
			});

			const { registerDoctorCommand } = await import('../src/commands/doctor.ts');
			const program = new Command();
			registerDoctorCommand(program);
			const logs: string[] = [];
			vi.spyOn(console, 'log').mockImplementation((s: unknown) => {
				if (typeof s === 'string') logs.push(s);
			});
			const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(dir);
			await program.parseAsync(['node', 'cli', 'doctor', '--json'], { from: 'node' });
			cwdSpy.mockRestore();
			const payload = JSON.parse(logs[0] ?? '{}');
			expect(Array.isArray(payload.localOverrides)).toBe(true);
			expect(payload.localOverrides[0].name).toBe('x');
			expect(['ok', 'warn']).toContain(payload.status);
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});
});
