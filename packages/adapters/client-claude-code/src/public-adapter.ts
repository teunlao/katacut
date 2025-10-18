import type { ApplyResultSummary, ClientAdapter, InstallStep, ReadMcpResult, Scope } from '@katacut/core';
import { addOrUpdateClaudeServer, ensureClaudeAvailable, removeClaudeServer } from './cli.js';
import { fallbackRemoveClaude, readProjectMcp, readUserMcp } from './files.js';

export const claudeCodeAdapter: ClientAdapter = {
	id: 'claude-code',
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
	async applyInstall(plan: readonly InstallStep[], scope: Scope, cwd?: string): Promise<ApplyResultSummary> {
		let added = 0;
		let updated = 0;
		let removed = 0;
		let failed = 0;
		for (const step of plan) {
			try {
				if (step.action === 'remove') {
					const r = await removeClaudeServer(step.name, scope, cwd);
					// Verify removal; if still present, fallback clean
					const state = scope === 'project' ? await readProjectMcp(cwd) : await readUserMcp();
					if (state.mcpServers[step.name]) {
						const cleaned = await fallbackRemoveClaude(step.name, scope, cwd);
						if (cleaned) removed++;
						else failed++;
					} else if (r.code === 0) {
						removed++;
					} else {
						failed++;
					}
				} else {
					const json = step.json;
					if (!json) {
						failed++;
						continue;
					}
					if (json.type === 'sse') {
						// Claude Code does not support SSE directly; treat as failure for this client
						failed++;
						continue;
					}
					const r = await addOrUpdateClaudeServer(step.name, json, scope, cwd);
					if (r.code === 0) {
						if (step.action === 'add') added++;
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
