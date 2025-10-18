import { Command } from 'commander';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock registry to inject a fake adapter
vi.mock('../src/lib/adapters/registry.ts', () => {
	const fakeAdapter = {
		id: 'claude-code',
		readProject: async () => ({ mcpServers: { proj: { type: 'stdio', command: 'echo' } } }),
		readUser: async () => ({
			source: '/home/user/.claude.json',
			mcpServers: { user: { type: 'http', url: 'https://x' } },
		}),
	} as const;
	return { getAdapter: async () => fakeAdapter };
});

describe('kc mcp list', () => {
	const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

	beforeEach(() => {
		logSpy.mockClear();
	});
	afterEach(() => {
		logSpy.mockClear();
	});

	it('prints both scopes by default without nulls', async () => {
		const { registerMcpCommand } = await import('../src/commands/mcp/index.ts');
		const program = new Command();
		registerMcpCommand(program);
		await program.parseAsync(['node', 'cli', 'mcp', 'list', '--client', 'claude-code'], { from: 'node' });

		expect(logSpy).toHaveBeenCalledTimes(1);
		const first = logSpy.mock.calls[0]?.[0];
		expect(typeof first).toBe('string');
		const payload = JSON.parse(String(first ?? '{}'));
		expect(payload.client).toBe('claude-code');
		expect(payload.project.mcpServers.proj).toEqual({ type: 'stdio', command: 'echo' });
		// source must be omitted when undefined
		expect(Object.hasOwn(payload.project, 'source')).toBe(false);
		expect(payload.user.source).toContain('.claude.json');
		expect(payload.user.mcpServers.user).toEqual({ type: 'http', url: 'https://x' });
	});

	it('prints only requested scope', async () => {
		const { registerMcpCommand } = await import('../src/commands/mcp/index.ts');
		const program = new Command();
		registerMcpCommand(program);
		await program.parseAsync(['node', 'cli', 'mcp', 'list', '--client', 'claude-code', '--scope', 'user'], {
			from: 'node',
		});

		const first = logSpy.mock.calls[0]?.[0];
		expect(typeof first).toBe('string');
		const payload = JSON.parse(String(first ?? '{}'));
		expect(payload.client).toBe('claude-code');
		expect(payload.user.mcpServers.user).toBeDefined();
		expect(payload.project).toBeUndefined();
	});
});
