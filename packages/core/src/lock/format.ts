import { createHash } from "node:crypto";
import { stableStringify } from "@katacut/utils";
import type { ReadMcpResult, Scope, ServerJson } from "../ports/adapters.js";

export interface LockEntry {
    readonly scope: Scope;
    readonly fingerprint: string;
    readonly resolvedVersion?: string;
    readonly snapshot?: ServerJson;
}
export interface Lockfile {
	readonly version: "1";
	readonly clients: readonly string[];
	readonly mcpServers: Record<string, LockEntry>;
}

export function computeFingerprint(json: ServerJson): string {
	const s = stableStringify(json);
	const h = createHash("sha256").update(s, "utf8").digest("hex");
	return h;
}

export function buildLock(clients: readonly string[], desired: Record<string, ServerJson>, scope: Scope): Lockfile {
    const entries: Record<string, LockEntry> = {};
    for (const [name, json] of Object.entries(desired)) entries[name] = { scope, fingerprint: computeFingerprint(json), snapshot: json };
    return { version: "1", clients: [...new Set(clients)] , mcpServers: entries };
}

export interface VerifyMismatch {
	readonly name: string;
	readonly expectedScope?: Scope;
	readonly actual?: { readonly scope?: Scope; readonly fingerprint?: string };
	readonly reason: "missing" | "fingerprint" | "scope" | "extra";
}

export interface VerifyReport {
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
	return { status: mismatches.length === 0 ? "ok" : "mismatch", mismatches };
}

/**
 * Merge two lockfiles for the same client.
 * - Preserves entries from the previous lock that are not present in the next one (do not drop unrelated targets).
 * - Updates/overwrites entries present in `next`.
 * - Keeps previous `resolvedVersion` when `next` does not provide one for an unchanged entry.
 * - If clients differ, returns `next` as a full replacement (v1 is single‑client).
 */
export function mergeLock(prev: Lockfile | undefined, next: Lockfile): Lockfile {
    if (!prev) return next;
    const merged: Lockfile = { version: "1", clients: Array.from(new Set([...(prev.clients ?? []), ...(next.clients ?? [])])), mcpServers: { ...prev.mcpServers } };
    for (const [name, entryNext] of Object.entries(next.mcpServers)) {
        const entryPrev = prev.mcpServers[name];
        if (!entryPrev) {
            merged.mcpServers[name] = entryNext;
            continue;
        }
        const resolvedVersion = entryNext.resolvedVersion ?? entryPrev.resolvedVersion;
        merged.mcpServers[name] = { ...entryPrev, ...entryNext, resolvedVersion };
    }
    return merged;
}
