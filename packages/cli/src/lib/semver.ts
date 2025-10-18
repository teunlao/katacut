export type Semver = { major: number; minor: number; patch: number; pre?: string };

export function parseSemver(v: string): Semver | undefined {
	const m = v.trim().match(/^(\d+)\.(\d+)\.(\d+)(-.+)?$/);
	if (!m) return undefined;
	return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]), pre: m[4] };
}

export function compareSemver(a: Semver, b: Semver): number {
	if (a.major !== b.major) return a.major < b.major ? -1 : 1;
	if (a.minor !== b.minor) return a.minor < b.minor ? -1 : 1;
	if (a.patch !== b.patch) return a.patch < b.patch ? -1 : 1;
	// Simple pre-release handling: non-prerelease > prerelease
	const ap = a.pre ? 1 : 0;
	const bp = b.pre ? 1 : 0;
	if (ap !== bp) return ap > bp ? -1 : 1;
	return 0;
}

export type Range = { includes: (v: Semver) => boolean };

function caretRange(base: Semver): Range {
	if (base.major > 0) {
		return { includes: (v) => v.major === base.major && compareSemver(v, base) >= 0 };
	}
	if (base.minor > 0) {
		return { includes: (v) => v.major === 0 && v.minor === base.minor && compareSemver(v, base) >= 0 };
	}
	return { includes: (v) => v.major === 0 && v.minor === 0 && compareSemver(v, base) >= 0 };
}

function tildeRange(base: Semver): Range {
	return { includes: (v) => v.major === base.major && v.minor === base.minor && compareSemver(v, base) >= 0 };
}

function majorRange(maj: number): Range {
	return { includes: (v) => v.major === maj };
}

function minorRange(maj: number, min: number): Range {
	return { includes: (v) => v.major === maj && v.minor === min };
}

export function rangeFromSpec(spec: string): Range | undefined {
	const s = spec.trim();
	if (s.startsWith("^")) {
		const p = parseSemver(s.slice(1));
		if (!p) return undefined;
		return caretRange(p);
	}
	if (s.startsWith("~")) {
		const p = parseSemver(s.slice(1));
		if (!p) return undefined;
		return tildeRange(p);
	}
	if (/^\d+$/.test(s)) return majorRange(Number(s));
	if (/^\d+\.\d+$/.test(s)) return minorRange(Number(s.split(".")[0]!), Number(s.split(".")[1]!));
	const p = parseSemver(s);
	if (p) {
		return { includes: (v) => compareSemver(v, p) === 0 };
	}
	return undefined; // tags handled elsewhere
}

export function pickMaxSatisfying(candidates: readonly string[], spec: string): string | undefined {
	const r = rangeFromSpec(spec);
	if (!r) return undefined;
	const parsed = candidates.map((v) => ({ v, p: parseSemver(v) })).filter((x): x is { v: string; p: Semver } => !!x.p);
	const filtered = parsed.filter((x) => r.includes(x.p));
	filtered.sort((a, b) => compareSemver(a.p, b.p));
	return filtered.length > 0 ? filtered[filtered.length - 1]?.v : undefined;
}
