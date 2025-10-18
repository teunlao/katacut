// Version normalization helpers for registry queries (do not attempt full semver parsing).
// Goal: accept shorthand like "5" or "5.4" and normalize to x.y.z form expected by the registry.

/**
 * Normalize a version string for registry requests.
 * - "" or undefined -> "latest"
 * - "latest" -> "latest"
 * - "5" -> "5.0.0"
 * - "5.4" -> "5.4.0"
 * - "5.4.1" -> as is
 * - other tags/prereleases (e.g., "beta", "1.2.3-rc.1") -> as is
 */
export function normalizeRegistryVersion(input: string | undefined): string {
	const v = (input ?? '').trim();
	if (v.length === 0) return 'latest';
	if (v === 'latest') return v;
	if (/^\d+$/.test(v)) return `${v}.0.0`;
	if (/^\d+\.\d+$/.test(v)) return `${v}.0`;
	// keep full semver or tags as-is
	return v;
}
