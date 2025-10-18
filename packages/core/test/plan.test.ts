import { buildDesired, diffByNames } from '@katacut/core';
import type { KatacutConfig } from '@katacut/schema';
import { describe, expect, it } from 'vitest';

describe('plan diff (core)', () => {
	const config: KatacutConfig = {
		version: '0.1.0',
		mcp: {
			github: { transport: 'http', url: 'https://api.githubcopilot.com/mcp', headers: {} },
			fs: { transport: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-filesystem', '.'], env: {} },
		},
	};

	it('diffs by names with prune', () => {
		const desired = buildDesired(config);
		const names = new Set(['github', 'extra']);
		const plan = diffByNames(desired, names, true);
		expect(plan.find((a) => a.action === 'add' && a.name === 'fs')).toBeTruthy();
		expect(plan.find((a) => a.action === 'update' && a.name === 'github')).toBeTruthy();
		expect(plan.find((a) => a.action === 'remove' && a.name === 'extra')).toBeTruthy();
	});
});
