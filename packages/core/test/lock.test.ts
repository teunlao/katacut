import { buildDesired, buildLock, computeFingerprint, verifyLock } from '@katacut/core';
import { describe, expect, it } from 'vitest';

describe('lockfile core', () => {
	it('computes stable fingerprint and verifies against current', () => {
		const desired = {
			a: { type: 'http', url: 'https://a' },
			b: { type: 'stdio', command: 'echo', args: ['x'] },
		} as const;
		const fpA = computeFingerprint(desired.a);
		const fpA2 = computeFingerprint({ type: 'http', url: 'https://a' });
		expect(fpA).toBe(fpA2);

		const lock = buildLock(['claude-code'], desired, 'project');
		const report = verifyLock(lock, { source: undefined, mcpServers: { ...desired } }, { mcpServers: {} });
		expect(report.status).toBe('ok');
	});

	it('treats empty stdio env as undefined for fingerprint stability (via desired builder)', () => {
		const cfgA = {
			version: '0.1.0',
			mcp: { s: { transport: 'stdio' as const, command: 'echo', args: ['x'], env: {} } },
		};
		const cfgB = { version: '0.1.0', mcp: { s: { transport: 'stdio' as const, command: 'echo', args: ['x'] } } };
		const dA = buildDesired(cfgA as unknown as import('@katacut/schema').KatacutConfig);
		const dB = buildDesired(cfgB as unknown as import('@katacut/schema').KatacutConfig);
		const fpA = computeFingerprint(dA.s);
		const fpB = computeFingerprint(dB.s);
		expect(fpA).toBe(fpB);
	});

	it('reports mismatch for missing and changed servers', () => {
		const desired = { x: { type: 'http', url: 'https://x' } } as const;
		const lock = buildLock(['claude-code'], desired, 'project');
		const report = verifyLock(lock, { source: undefined, mcpServers: {} }, { mcpServers: {} });
		expect(report.status).toBe('mismatch');
		expect(report.mismatches[0]?.reason).toBe('missing');
	});

	it('detects scope mismatch and extras', () => {
		const lock = {
			version: '1' as const,
			clients: ['claude-code'],
			mcpServers: {
				a: { scope: 'project' as const, fingerprint: computeFingerprint({ type: 'http', url: 'https://a' }) },
			},
		};
		const project = { mcpServers: {} } as const;
		const user = {
			mcpServers: { a: { type: 'http', url: 'https://a' }, extraU: { type: 'stdio', command: 'echo' } },
		} as const;
		const report = verifyLock(lock, project, user);
		expect(report.status).toBe('mismatch');
		expect(report.mismatches.find((m) => m.name === 'a' && m.reason === 'scope')).toBeTruthy();
		expect(
			report.mismatches.find((m) => m.name === 'extraU' && m.reason === 'extra' && m.actual?.scope === 'user'),
		).toBeTruthy();
	});
});
