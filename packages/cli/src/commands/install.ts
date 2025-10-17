import { ensureClaudeAvailable } from "@katacut/adapter-client-claude-code";
import type { Command } from "commander";
import { getAdapter } from "../lib/adapters/registry.js";
import type { Scope } from "@katacut/core";
import { diffDesiredCurrent } from "../lib/plan.js";
import { loadAndValidateConfig } from "../lib/config.js";

export interface InstallOptions {
	readonly config?: string;
	readonly scope?: Scope;
	readonly client?: string;

	readonly dryRun?: boolean;
	readonly prune?: boolean;
}

export function registerInstallCommand(program: Command) {
	program
		.command("install")
		.description("Install (apply) configuration to target client via MCP")
		.option("-c, --config <path>", "path to configuration file", undefined)
		.option("--scope <scope>", "Scope: user|project (default: user)")
    .option("--client <id>", "Client id (default: ClaudeCode)")
		.option("--dry-run", "print plan without changes", false)
		.option("--prune", "remove servers not present in config", false)
		.action(async (options: InstallOptions) => {
			const cwd = process.cwd();
			if (!(await ensureClaudeAvailable())) {
				throw new Error("Claude CLI is not available in PATH. Please install and try again.");
			}

			const config = await loadAndValidateConfig(options.config);
      const clientId = options.client ?? "ClaudeCode";
			const adapter = await getAdapter(clientId);
			const scope: Scope = options.scope === "project" ? "project" : "user";

      const desired = adapter.desiredFromConfig(config);

			const current = scope === "project" ? await adapter.readProject(cwd) : await adapter.readUser();
			const plan = diffDesiredCurrent(desired, current.mcpServers, Boolean(options.prune), true);

			// Print plan always
			console.log("Plan:");
			console.log(JSON.stringify(plan, null, 2));

			if (options.dryRun) return;

			let skipped = 0;
			for (const step of plan) if (step.action === "skip") skipped++;
			const applyPlan = plan
				.filter((p) => p.action !== "skip")
				.map((p) => ({ action: p.action as "add" | "update" | "remove", name: p.name, json: p.json }));
			const summary = await adapter.applyInstall(applyPlan, scope, cwd);
			console.log(
				`Summary: added=${summary.added} updated=${summary.updated} removed=${summary.removed} skipped=${skipped} failed=${summary.failed}`,
			);
			if (summary.failed > 0) process.exitCode = 1;
		});
}
