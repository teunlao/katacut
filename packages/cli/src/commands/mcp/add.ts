import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Lockfile, Scope } from "@katacut/core";
import { buildLock, diffDesiredCurrent } from "@katacut/core";
import type { KatacutConfig, McpServerConfig } from "@katacut/schema";
import type { Command } from "commander";
import { getAdapter } from "../../lib/adapters/registry.js";
import { loadAndValidateConfig } from "../../lib/config.js";
import { resolveFormatFlags } from "../../lib/format.js";
import { isServerJson } from "../../lib/guards.js";
import { buildSummaryLine, printTableSection } from "../../lib/print.js";
import { appendProjectStateRun, buildStateEntries } from "../../lib/state.js";

function isHttpUrl(ref: string): URL | undefined {
	try {
		const u = new URL(ref);
		return u.protocol === "http:" || u.protocol === "https:" ? u : undefined;
	} catch {
		return undefined;
	}
}

async function fetchServerJson(u: URL, timeoutMs = 10000, maxSize = 262144) {
	const ctrl = new AbortController();
	const to = setTimeout(() => ctrl.abort(), timeoutMs);
	try {
		const res = await fetch(u, { signal: ctrl.signal, redirect: "follow" });
		const ct = res.headers.get("content-type") ?? "";
		if (!ct.includes("json")) {
			// allow anyway but warn via throw; we want strictness
			throw new Error(`Unexpected content-type: ${ct}`);
		}
		const text = await res.text();
		if (text.length > maxSize) throw new Error("Descriptor too large");
		let parsed: unknown;
		try {
			parsed = JSON.parse(text);
		} catch {
			throw new Error("Invalid JSON");
		}
		if (!isServerJson(parsed)) throw new Error("Descriptor is not a valid ServerJson (http|stdio)");
		return parsed;
	} finally {
		clearTimeout(to);
	}
}

function deriveNameFromUrl(u: URL): string {
	const path = u.pathname.replace(/\/+$/, "");
	const last = path.split("/").filter(Boolean).pop() ?? "server";
	return last.replace(/\.jsonc?$/i, "");
}

function toConfigFromServerJson(
	s:
		| { type: "http"; url: string; headers?: Record<string, string> }
		| { type: "stdio"; command: string; args?: string[]; env?: Record<string, string> },
): McpServerConfig {
	if (s.type === "http") return { transport: "http", url: s.url, headers: s.headers };
	return { transport: "stdio", command: s.command, args: s.args, env: s.env };
}

// ---- Registry URL support (v0 / v0.1) ----
function isRegistryVersionUrl(u: URL): boolean {
	if (u.hostname !== "registry.modelcontextprotocol.io") return false;
	return /^\/v0(\.1)?\/servers\/.+\/versions\/(latest|[A-Za-z0-9_.-]+)$/.test(u.pathname);
}

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
			const command = useNpx ? "npx" : p.runtimeHint ?? "npx";
			const args = useNpx ? ["-y", p.identifier] : [p.identifier];
			return { type: "stdio" as const, command, args };
		}
	}
	return undefined;
}

async function fetchServerJsonFromRegistry(u: URL) {
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
	if (http) return { name: srv.name, server: http };
	const stdio = Array.isArray(srv.packages) ? pickStdioFromPackages(srv.packages) : undefined;
	if (stdio) return { name: srv.name, server: stdio };
	throw new Error("No usable transport (http/stdio) found in registry entry");
}

function nameFromRegistryFull(full: string): string {
	const i = full.indexOf("/");
	return i >= 0 ? full.slice(i + 1) : full;
}

export function registerMcpAdd(parent: Command) {
	parent
		.command("add")
		.description("Add an MCP server by URL or by registry name (URL autodetected)")
		.argument("<ref>", "URL or registry name")
		.option("--client <id>", "Client id (default: claude-code)")
		.option("--scope <scope>", "Scope: project|user (default: project)")
		.option("--registry <url>", "Registry base URL (default: official)")
		.option("--version <semver>", "Registry version (default: latest)")
		.option("--dry-run", "Print plan without applying", false)
		.option("-y, --yes", "Confirm if permissions require explicit consent", false)
		.option("--json", "Machine-readable output: only JSON plan", false)
		.option("--no-summary", "Suppress tables/labels", false)
		.action(
			async (
				ref: string,
				opts: {
					readonly client?: string;
					readonly scope?: Scope;
					readonly json?: boolean;
					readonly noSummary?: boolean;
					readonly dryRun?: boolean;
					readonly yes?: boolean;
					readonly registry?: string;
					readonly version?: string;
				},
			) => {
				const clientId = opts.client ?? "claude-code";
				const adapter = await getAdapter(clientId);
				const cwd = process.cwd();
				const scope: Scope = opts.scope === "user" ? "user" : "project";
				const fmt = resolveFormatFlags(process.argv, { json: opts.json, noSummary: opts.noSummary });

				// Resolve descriptor
				const asUrl = isHttpUrl(ref);
      let name: string;
				if (asUrl && isRegistryVersionUrl(asUrl)) {
					const { name: regName, server } = await fetchServerJsonFromRegistry(asUrl);
					name = nameFromRegistryFull(regName);
					const cfgEntry = toConfigFromServerJson(server);

					const config = await loadAndValidateConfig(undefined);
					const edited: KatacutConfig = { ...config, mcp: { ...(config.mcp ?? {}) } };
					if (!edited.mcp) edited.mcp = {};
					edited.mcp[name] = cfgEntry;
					const cfgPath = resolve(cwd, "katacut.config.jsonc");
					await writeFile(cfgPath, JSON.stringify(edited, null, 2), "utf8");

					const desired = adapter.desiredFromConfig(edited);
					const current = scope === "project" ? await adapter.readProject(cwd) : await adapter.readUser();
					const plan = diffDesiredCurrent(desired, current.mcpServers, false, true).filter((p) => p.name === name);
					console.log(JSON.stringify(plan, null, 2));
					printTableSection("Plan", ["Name", "Action", "Scope"], plan.map((p) => [p.name, p.action.toUpperCase(), scope] as unknown as readonly string[]), fmt);
					if (opts.dryRun) return;
					const applyPlan = plan
						.filter((p) => p.action !== "skip")
						.map((p) => ({ action: p.action as "add" | "update" | "remove", name: p.name, json: p.json }));
					const summary = await adapter.applyInstall(applyPlan, scope, cwd);
					const skipped = plan.filter((p) => p.action === "skip").length;
					if (!fmt.json && !fmt.noSummary) console.log(buildSummaryLine(summary, skipped));
					printTableSection("Summary", ["Added", "Updated", "Removed", "Skipped", "Failed"], [[String(summary.added), String(summary.updated), String(summary.removed), String(skipped), String(summary.failed)]], fmt);
					if (summary.failed > 0) { process.exitCode = 1; return; }
					const expectedLock: Lockfile = buildLock(adapter.id, desired, scope);
					const lockPath = resolve(cwd, "katacut.lock.json");
					await writeFile(lockPath, JSON.stringify(expectedLock, null, 2), "utf8");
					const stateEntries = buildStateEntries(plan, desired, current.mcpServers, scope);
					await appendProjectStateRun(cwd, { at: new Date().toISOString(), client: adapter.id, requestedScope: scope, realizedScope: scope, mode: "native", intent: "project", result: summary, entries: stateEntries });
					return;
				}

				if (asUrl) {
					const sj = await fetchServerJson(asUrl);
        name = deriveNameFromUrl(asUrl);
					const cfgEntry = toConfigFromServerJson(sj);

					// Load and edit config
					const config = await loadAndValidateConfig(undefined);
					const edited: KatacutConfig = { ...config, mcp: { ...(config.mcp ?? {}) } };
        if (!edited.mcp) edited.mcp = {};
        edited.mcp[name] = cfgEntry;
					const cfgPath = resolve(cwd, "katacut.config.jsonc");
					await writeFile(cfgPath, JSON.stringify(edited, null, 2), "utf8");

					// Plan and apply using adapter
					const desired = adapter.desiredFromConfig(edited);
					const current = scope === "project" ? await adapter.readProject(cwd) : await adapter.readUser();
					const plan = diffDesiredCurrent(desired, current.mcpServers, false, true).filter((p) => p.name === name);

					// Output plan
					console.log(JSON.stringify(plan, null, 2));
					printTableSection(
						"Plan",
						["Name", "Action", "Scope"],
						plan.map((p) => [p.name, p.action.toUpperCase(), scope] as unknown as readonly string[]),
						fmt,
					);
					if (opts.dryRun) return;

					// Apply
					const applyPlan = plan
						.filter((p) => p.action !== "skip")
						.map((p) => ({ action: p.action as "add" | "update" | "remove", name: p.name, json: p.json }));
					const summary = await adapter.applyInstall(applyPlan, scope, cwd);
					const skipped = plan.filter((p) => p.action === "skip").length;
					if (!fmt.json && !fmt.noSummary) console.log(buildSummaryLine(summary, skipped));
					printTableSection(
						"Summary",
						["Added", "Updated", "Removed", "Skipped", "Failed"],
						[
							[
								String(summary.added),
								String(summary.updated),
								String(summary.removed),
								String(skipped),
								String(summary.failed),
							],
						],
						fmt,
					);
					if (summary.failed > 0) {
						process.exitCode = 1;
						return;
					}

					// State & lock
					const expectedLock: Lockfile = buildLock(adapter.id, desired, scope);
					const lockPath = resolve(cwd, "katacut.lock.json");
					await writeFile(lockPath, JSON.stringify(expectedLock, null, 2), "utf8");
					const stateEntries = buildStateEntries(plan, desired, current.mcpServers, scope);
					await appendProjectStateRun(cwd, {
						at: new Date().toISOString(),
						client: adapter.id,
						requestedScope: scope,
						realizedScope: scope,
						mode: "native",
						intent: "project",
						result: summary,
						entries: stateEntries,
					});
					return;
				}

				// Name path (registry) — placeholder error until implemented
				const base = opts.registry ?? "https://registry.modelcontextprotocol.io";
				console.error(`Registry lookup not yet implemented for ref='${ref}'. Planned base: ${base}`);
				process.exitCode = 1;
			},
		);
}
