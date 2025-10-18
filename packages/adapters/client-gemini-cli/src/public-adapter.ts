import type { ApplyResultSummary, ClientAdapter, InstallStep, ReadMcpResult, Scope } from '@katacut/core';
import { addOrUpdateGeminiServer, ensureGeminiAvailable, removeGeminiServer } from './cli.js';
import { fallbackRemoveGemini, readProjectGemini, readUserGemini } from './files.js';

export const geminiCliAdapter: ClientAdapter = {
	id: 'gemini-cli',
	capabilities() {
		return {
			supportsProject: true,
			supportsUser: true,
			emulateProjectWithUser: false,
			supportsGlobalExplicit: false,
		};
	},
	async readProject(cwd?: string): Promise<ReadMcpResult> {
		return readProjectGemini(cwd);
	},
	async readUser(): Promise<ReadMcpResult> {
		return readUserGemini();
	},
	async applyInstall(plan: readonly InstallStep[], scope: Scope, cwd?: string): Promise<ApplyResultSummary> {
		let added = 0;
		let updated = 0;
		let removed = 0;
		let failed = 0;
		for (const step of plan) {
			try {
				if (step.action === 'remove') {
					const r = await removeGeminiServer(step.name, scope, cwd);
					const state = scope === 'project' ? await readProjectGemini(cwd) : await readUserGemini();
					if (state.mcpServers[step.name]) {
						const cleaned = await fallbackRemoveGemini(step.name, scope, cwd);
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
					const r = await addOrUpdateGeminiServer(step.name, json, scope, cwd);
					if (r.code === 0) {
						if (step.action === 'add') added++;
						else updated++;
					} else failed++;
				}
			} catch {
				failed++;
			}
		}
		return { added, updated, removed, failed };
	},
	async checkAvailable() {
		return ensureGeminiAvailable();
	},
};
