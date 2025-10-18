import { createHash } from "node:crypto";
import { stableStringify } from "@katacut/utils";
import type { ReadMcpResult, Scope, ServerJson } from "../ports/adapters.js";

export interface LockEntry {
	readonly scope: Scope;
	readonly fingerprint: string;
}
export interface Lockfile {
	readonly version: "1";
	readonly client: string;
	readonly mcpServers: Record<string, LockEntry>;
}

export function computeFingerprint(json: ServerJson): string {
	const s = stableStringify(json);
	const h = createHash("sha256").update(s, "utf8").digest("hex");
	return h;
}

export function buildLock(client: string, desired: Record<string, ServerJson>, scope: Scope): Lockfile {
	const entries: Record<string, LockEntry> = {};
	for (const [name, json] of Object.entries(desired)) entries[name] = { scope, fingerprint: computeFingerprint(json) };
	return { version: "1", client, mcpServers: entries };
}

export interface VerifyMismatch {
	readonly name: string;
	readonly expectedScope?: Scope;
	readonly actual?: { readonly scope?: Scope; readonly fingerprint?: string };
	readonly reason: "missing" | "fingerprint" | "scope" | "extra";
}

export interface VerifyReport {
	readonly client: string;
	readonly status: "ok" | "mismatch";
	readonly mismatches: readonly VerifyMismatch[];
}

export function verifyLock(lock: Lockfile, project: ReadMcpResult, user: ReadMcpResult): VerifyReport {
	const mismatches: VerifyMismatch[] = [];
	for (const [name, entry] of Object.entries(lock.mcpServers)) {
		const currentJson = entry.scope === "project" ? project.mcpServers[name] : user.mcpServers[name];
		if (!currentJson) {
			const other = entry.scope === "project" ? user.mcpServers[name] : project.mcpServers[name];
			if (other) {
				mismatches.push({
					name,
					expectedScope: entry.scope,
					actual: { scope: entry.scope === "project" ? "user" : "project" },
					reason: "scope",
				});
			} else {
				mismatches.push({ name, expectedScope: entry.scope, reason: "missing" });
			}
			continue;
		}
		const fp = computeFingerprint(currentJson);
		if (fp !== entry.fingerprint) {
			mismatches.push({
				name,
				expectedScope: entry.scope,
				actual: { scope: entry.scope, fingerprint: fp },
				reason: "fingerprint",
			});
		}
	}
	// Extras present in current state but absent in lock
	const lockNames = new Set(Object.keys(lock.mcpServers));
	for (const name of Object.keys(project.mcpServers)) {
		if (!lockNames.has(name)) mismatches.push({ name, actual: { scope: "project" }, reason: "extra" });
	}
	for (const name of Object.keys(user.mcpServers)) {
		if (!lockNames.has(name)) mismatches.push({ name, actual: { scope: "user" }, reason: "extra" });
	}
	return { client: lock.client, status: mismatches.length === 0 ? "ok" : "mismatch", mismatches };
}
