import { isPlainObject } from '@katacut/utils';
import { describe, expect, it } from 'vitest';

describe('isPlainObject', () => {
	it('accepts plain objects', () => {
		expect(isPlainObject({})).toBe(true);
		expect(isPlainObject({ a: 1 })).toBe(true);
	});
	it('rejects non-objects', () => {
		for (const v of [null, [], 1, 's', () => {}]) {
			expect(isPlainObject(v)).toBe(false);
		}
	});
});
