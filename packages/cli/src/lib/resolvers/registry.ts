import type { McpServerConfig } from "@katacut/schema";
import type { ResolvedServer } from "./types.js";

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
	if (u.hostname !== "registry.modelcontextprotocol.io") return false;
	return /^\/v0(\.1)?\/servers\/.+\/versions\/(latest|[A-Za-z0-9_.-]+)$/.test(u.pathname);
}

function pickHttpFromRemotes(remotes: ReadonlyArray<RegistryRemote>) {
	for (const r of remotes) {
		const t = r?.type?.toLowerCase();
		if (!t) continue;
		if (t === "http" || t === "streamable-http" || t === "sse") {
			const url = r.url;
			if (typeof url !== "string" || url.length === 0) continue;
			const headers = Array.isArray(r.headers)
				? Object.fromEntries(
						(r.headers as ReadonlyArray<{ readonly name?: string; readonly value?: string }>)
							.filter((h) => typeof h?.name === "string" && typeof h?.value === "string")
							.map((h) => [String(h.name), String(h.value)]) as ReadonlyArray<[string, string]>,
					)
				: undefined;
			return { type: "http" as const, url, headers };
		}
	}
	return undefined;
}

function pickStdioFromPackages(packages: ReadonlyArray<RegistryPackage>) {
	for (const p of packages) {
		const isNpm = (p.registryType ?? "").toLowerCase() === "npm";
		const transType = p.transport?.type?.toLowerCase();
		if (isNpm && transType === "stdio" && typeof p.identifier === "string" && p.identifier.length > 0) {
			const useNpx = (p.runtimeHint ?? "npx").toLowerCase() === "npx" || !p.runtimeHint;
			const command = useNpx ? "npx" : (p.runtimeHint ?? "npx");
			const args = useNpx ? ["-y", p.identifier] : [p.identifier];
			return { type: "stdio" as const, command, args };
		}
	}
	return undefined;
}

export async function resolveFromRegistry(u: URL): Promise<ResolvedServer> {
	const res = await fetch(u, { redirect: "follow" });
	if (!res.ok) throw new Error(`Registry request failed: ${res.status}`);
	const data = (await res.json()) as unknown;
	if (!data || typeof data !== "object" || !("server" in (data as Record<string, unknown>))) {
		throw new Error("Invalid registry response");
	}
	const rr = data as RegistryResponse;
	const srv = rr.server;
	if (!srv || typeof srv.name !== "string") throw new Error("Registry server entry missing 'name'");
	const http = Array.isArray(srv.remotes) ? pickHttpFromRemotes(srv.remotes) : undefined;
	const stdio = Array.isArray(srv.packages) ? pickStdioFromPackages(srv.packages) : undefined;
	const name = srv.name.includes("/") ? srv.name.split("/")[1] : srv.name;
	if (http) {
		const cfg: McpServerConfig = { transport: "http", url: http.url, headers: http.headers };
		return { name, config: cfg };
	}
	if (stdio) {
		const cfg: McpServerConfig = { transport: "stdio", command: stdio.command, args: stdio.args };
		return { name, config: cfg };
	}
	throw new Error("No usable transport (http/stdio) found in registry entry");
}
