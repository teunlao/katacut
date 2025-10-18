import { KatacutError } from './errors.js';

export function assert(condition: unknown, message: string): asserts condition {
	if (!condition) {
		throw new KatacutError(message);
	}
}
