import type { McpServerConfig } from '@katacut/schema';
import { maxSatisfying, valid, validRange } from 'semver';
import { REGISTRY_DEFAULT_BASE, REGISTRY_HOST } from '../constants.js';
import type { ResolvedServer } from './types.js';

type RegistryRemote = {
	readonly type?: string;
	readonly url?: string;
	readonly headers?: ReadonlyArray<{ readonly name?: string; readonly value?: string }>;
};
type RegistryPackage = {
	readonly registryType?: string;
	readonly identifier?: string;
	readonly transport?: { readonly type?: string };
	readonly runtimeHint?: string;
};

type RegistryServer = {
	readonly name?: string;
	readonly remotes?: ReadonlyArray<RegistryRemote> | null;
	readonly packages?: ReadonlyArray<RegistryPackage> | null;
};

type RegistryResponse = { readonly server?: RegistryServer };

export function isRegistryVersionUrl(u: URL): boolean {
	if (u.hostname !== REGISTRY_HOST) return false;
	return /^\/v0(\.1)?\/servers\/.+\/versions\/(latest|[A-Za-z0-9_.-]+)$/.test(u.pathname);
}

export function buildRegistryVersionUrl(name: string, version: string | undefined, base?: string): URL {
	const ver = version && version.length > 0 ? version : 'latest';
	const path = `/v0.1/servers/${encodeURIComponent(name)}/versions/${encodeURIComponent(ver)}`;
	const origin = base ?? REGISTRY_DEFAULT_BASE;
	return new URL(path, origin);
}

function pickHttpFromRemotes(remotes: ReadonlyArray<RegistryRemote>) {
	for (const r of remotes) {
		const t = r?.type?.toLowerCase();
		if (!t) continue;
		if (t === 'http' || t === 'streamable-http' || t === 'sse') {
			const url = r.url;
			if (typeof url !== 'string' || url.length === 0) continue;
			const headers = Array.isArray(r.headers)
				? Object.fromEntries(
						(r.headers as ReadonlyArray<{ readonly name?: string; readonly value?: string }>)
							.filter((h) => typeof h?.name === 'string' && typeof h?.value === 'string')
							.map((h) => [String(h.name), String(h.value)]) as ReadonlyArray<[string, string]>,
					)
				: undefined;
			return { type: 'http' as const, url, headers };
		}
	}
	return undefined;
}

function pickStdioFromPackages(packages: ReadonlyArray<RegistryPackage>) {
	for (const p of packages) {
		const isNpm = (p.registryType ?? '').toLowerCase() === 'npm';
		const transType = p.transport?.type?.toLowerCase();
		if (isNpm && transType === 'stdio' && typeof p.identifier === 'string' && p.identifier.length > 0) {
			const useNpx = (p.runtimeHint ?? 'npx').toLowerCase() === 'npx' || !p.runtimeHint;
			const command = useNpx ? 'npx' : (p.runtimeHint ?? 'npx');
			const args = useNpx ? ['-y', p.identifier] : [p.identifier];
			return { type: 'stdio' as const, command, args };
		}
	}
	return undefined;
}

export async function resolveFromRegistry(
	u: URL,
	opts?: { readonly requestedVersion?: string },
): Promise<ResolvedServer> {
	const res = await fetch(u, { redirect: 'follow' });
	if (!res.ok) throw new Error(`Registry request failed: ${res.status}`);
	const data = (await res.json()) as unknown;
	if (!data || typeof data !== 'object' || !('server' in (data as Record<string, unknown>))) {
		throw new Error('Invalid registry response');
	}
	const rr = data as RegistryResponse;
	const srv = rr.server;
	if (!srv || typeof srv.name !== 'string') throw new Error("Registry server entry missing 'name'");
	const http = Array.isArray(srv.remotes) ? pickHttpFromRemotes(srv.remotes) : undefined;
	const stdio = Array.isArray(srv.packages) ? pickStdioFromPackages(srv.packages) : undefined;
	const name = srv.name.includes('/') ? srv.name.split('/')[1] : srv.name;
	if (http) {
		const cfg: McpServerConfig = { transport: 'http', url: http.url, headers: http.headers };
		return { name, config: cfg };
	}
	if (stdio) {
		// Pin npm version in args when a concrete version was requested and transport is stdio via npx
		let args = stdio.args;
		const req = (opts?.requestedVersion ?? '').trim();
		if (req && req !== 'latest' && Array.isArray(args) && args.length >= 2) {
			// Expect args == ["-y", identifier]
			const ident = String(args[1] ?? '');
			if (ident) {
				const at = ident.lastIndexOf('@');
				const hasVersion = at > 0; // >0 means something like "@scope/pkg@1.2.3" or "pkg@1.2.3"
				if (!hasVersion) args = [String(args[0]), `${ident}@${req}`];
			}
		}
		const cfg: McpServerConfig = { transport: 'stdio', command: stdio.command, args };
		return { name, config: cfg };
	}
	throw new Error('No usable transport (http/stdio) found in registry entry');
}

export async function resolveCanonicalNameByShort(shortName: string, base?: string): Promise<string> {
	const origin = base ?? REGISTRY_DEFAULT_BASE;
	const url = new URL(`/v0.1/servers?search=${encodeURIComponent(shortName)}`, origin);
	const res = await fetch(url, {
		headers: { Accept: 'application/json, application/problem+json' },
		redirect: 'follow',
	});
	if (!res.ok) throw new Error(`Registry search failed: ${res.status}`);
	const data = (await res.json()) as unknown;
	if (!data || typeof data !== 'object' || !('servers' in (data as Record<string, unknown>))) {
		throw new Error('Invalid registry search response');
	}
	const arr = (data as { servers?: ReadonlyArray<{ server?: { name?: string } }> }).servers ?? [];
	const names = arr.map((e) => e?.server?.name).filter((n): n is string => typeof n === 'string' && n.length > 0);
	const matches = Array.from(new Set(names.filter((n) => n.endsWith(`/${shortName}`))));
	if (matches.length === 1) return matches[0];
	if (matches.length === 0) throw new Error(`No registry entries found for short name '${shortName}'`);
	throw new Error(
		`Ambiguous short name '${shortName}'; candidates: ${matches.join(', ')}. Please specify full 'namespace/name'.`,
	);
}

export async function resolveConcreteVersion(
	canonicalName: string,
	versionSpec: string,
	base?: string,
): Promise<string> {
	const s = versionSpec.trim();
	if (s.length === 0 || s === 'latest' || /[a-zA-Z]/.test(s)) return s.length === 0 ? 'latest' : s; // tags & latest
	// Exact semver provided -> use as-is (no search roundtrip)
	if (valid(s)) return s;
	const origin = base ?? REGISTRY_DEFAULT_BASE;
	const url = new URL(`/v0.1/servers?search=${encodeURIComponent(canonicalName)}`, origin);
	const res = await fetch(url, {
		headers: { Accept: 'application/json, application/problem+json' },
		redirect: 'follow',
	});
	if (!res.ok) throw new Error(`Registry search failed: ${res.status}`);
	const data = (await res.json()) as unknown;
	const arr = (data as { servers?: ReadonlyArray<{ server?: { name?: string; version?: string } }> }).servers ?? [];
	const versions = arr
		.map((e) => e?.server)
		.filter((s): s is { name: string; version?: string } => !!s && typeof s.name === 'string')
		.filter((s) => s.name === canonicalName)
		.map((s) => s.version ?? '')
		.filter((v) => typeof v === 'string' && v.length > 0);
	const range = validRange(s);
	if (!range) throw new Error(`Invalid version/range '${s}'`);
	const match = maxSatisfying(versions, range);
	if (!match) throw new Error(`No versions satisfy '${s}' for '${canonicalName}'`);
	return match;
}
