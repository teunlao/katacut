import { describe, expect, it } from 'vitest';
import { claudeCodeAdapter } from '../../client-claude-code/src/public-adapter.js';

describe('Claude Code adapter - SSE unsupported', () => {
	it('fails steps with type sse without calling CLI', async () => {
		const summary = await claudeCodeAdapter.applyInstall(
			[{ action: 'add', name: 'sse-srv', json: { type: 'sse', url: 'https://events.example/sse' } }],
			'project',
		);
		expect(summary.added).toBe(0);
		expect(summary.updated).toBe(0);
		expect(summary.removed).toBe(0);
		expect(summary.failed).toBe(1);
	});
});
