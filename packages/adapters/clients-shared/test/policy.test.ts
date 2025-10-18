import { canApplyTransport } from '@katacut/adapter-clients-shared';
import { describe, expect, it } from 'vitest';

describe('transport policy', () => {
	it('fails unsupported transports', () => {
		const dec = canApplyTransport({ unsupported: ['sse'] }, { type: 'sse', url: 'https://x' });
		expect(dec).not.toBe('ok');
		if (dec !== 'ok') expect(dec.kind).toBe('fail');
	});

	it('passes supported transports', () => {
		const d1 = canApplyTransport({ unsupported: ['sse'] }, { type: 'http', url: 'https://x' });
		expect(d1).toBe('ok');
		const d2 = canApplyTransport({ unsupported: ['sse'] }, { type: 'stdio', command: 'echo' });
		expect(d2).toBe('ok');
	});
});
