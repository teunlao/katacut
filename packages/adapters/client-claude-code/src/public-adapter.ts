import type { ApplyResultSummary, ClientAdapter, InstallStep, ReadMcpResult, Scope, ServerJson } from "@katacut/core";
import type { KatacutConfig, McpServerConfig } from "@katacut/schema";
import { addOrUpdateClaudeServer, ensureClaudeAvailable, removeClaudeServer } from "./cli.js";
import { readProjectMcp, readUserMcp } from "./files.js";
import { toClaudeServerJson } from "./map.js";

export const claudeCodeAdapter: ClientAdapter = {
	id: "claude-code",
	capabilities() {
		return {
			supportsProject: true,
			supportsUser: true,
			emulateProjectWithUser: false,
			supportsGlobalExplicit: false,
		};
	},
	async readProject(cwd?: string): Promise<ReadMcpResult> {
		return readProjectMcp(cwd);
	},
	async readUser(): Promise<ReadMcpResult> {
		return readUserMcp();
	},
	desiredFromConfig(config: unknown): Record<string, ServerJson> {
		const out: Record<string, ServerJson> = {};
		const cfg = config as KatacutConfig;
		const src: Record<string, McpServerConfig> = (cfg.mcp ?? {}) as Record<string, McpServerConfig>;
		for (const name of Object.keys(src)) out[name] = toClaudeServerJson(src[name]);
		return out;
	},
	async applyInstall(plan: readonly InstallStep[], scope: Scope, cwd?: string): Promise<ApplyResultSummary> {
		let added = 0;
		let updated = 0;
		let removed = 0;
		let failed = 0;
		for (const step of plan) {
			try {
				if (step.action === "remove") {
					const r = await removeClaudeServer(step.name, scope, cwd);
					if (r.code === 0) removed++;
					else failed++;
				} else {
					const json = step.json;
					if (!json) {
						failed++;
						continue;
					}
					const r = await addOrUpdateClaudeServer(step.name, json, scope, cwd);
					if (r.code === 0) {
						if (step.action === "add") added++;
						else updated++;
					} else {
						failed++;
					}
				}
			} catch {
				failed++;
			}
		}
		return { added, updated, removed, failed };
	},
	async checkAvailable() {
		return ensureClaudeAvailable();
	},
};
