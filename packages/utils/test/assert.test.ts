import { assert, KatacutError } from '@katacut/utils';
import { describe, expect, it } from 'vitest';

describe('assert', () => {
	it('does not throw when condition is truthy', () => {
		expect(() => assert(true, 'nope')).not.toThrow();
	});

	it('throws KatacutError with provided message when falsy', () => {
		expect(() => assert(false, 'bad')).toThrow(new KatacutError('bad'));
	});
});
