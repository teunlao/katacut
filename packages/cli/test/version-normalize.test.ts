import { describe, expect, it } from 'vitest';
import { normalizeRegistryVersion } from '../src/lib/version.js';

describe('normalizeRegistryVersion', () => {
	it('handles empty and latest', () => {
		expect(normalizeRegistryVersion(undefined)).toBe('latest');
		expect(normalizeRegistryVersion('')).toBe('latest');
		expect(normalizeRegistryVersion('latest')).toBe('latest');
	});
	it('pads numeric and major.minor', () => {
		expect(normalizeRegistryVersion('5')).toBe('5.0.0');
		expect(normalizeRegistryVersion('5.4')).toBe('5.4.0');
	});
	it('keeps full semver and tags', () => {
		expect(normalizeRegistryVersion('1.2.3')).toBe('1.2.3');
		expect(normalizeRegistryVersion('1.2.3-rc.1')).toBe('1.2.3-rc.1');
		expect(normalizeRegistryVersion('beta')).toBe('beta');
	});
});
