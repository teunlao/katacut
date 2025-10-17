import type { ClaudeScope } from "@katacut/adapter-client-claude";
import { addOrUpdateClaudeServer, ensureClaudeAvailable, removeClaudeServer } from "@katacut/adapter-client-claude";
import type { Command } from "commander";
import { desiredFromConfig, diffByNames } from "../lib/claude-plan.js";
import { loadAndValidateConfig } from "../lib/config.js";
import { listClaudeServerNames } from "@katacut/adapter-client-claude";

export interface InstallOptions {
	readonly config?: string;
	readonly scope?: ClaudeScope;

	readonly dryRun?: boolean;
	readonly prune?: boolean;
}

export function registerInstallCommand(program: Command) {
	program
		.command("install")
		.description("Install (apply) configuration to Claude Code via MCP")
		.option("-c, --config <path>", "path to configuration file", undefined)
		.option("--scope <scope>", "Claude scope: user|project (default: user)")
		.option("--dry-run", "print plan without changes", false)
		.option("--prune", "remove servers not present in config", false)
		.action(async (options: InstallOptions) => {
			const cwd = process.cwd();
			if (!(await ensureClaudeAvailable())) {
				throw new Error("Claude CLI is not available in PATH. Please install and try again.");
			}

			const config = await loadAndValidateConfig(options.config);
			const scope: ClaudeScope = options.scope === "project" ? "project" : "user";

			const desired = desiredFromConfig(config);

			// Во всех scope используем фактический список из `claude mcp list`
			const names = await listClaudeServerNames(cwd);
			const plan = diffByNames(desired, names, Boolean(options.prune));

			// Print plan always
			console.log("Plan:");
			console.log(JSON.stringify(plan, null, 2));

			if (options.dryRun) return;

			let added = 0,
				updated = 0,
				removed = 0,
				skipped = 0,
				failed = 0;
			for (const step of plan) {
				if (step.action === "skip") {
					skipped++;
					continue;
				}
				if (step.action === "remove") {
					const res = await removeClaudeServer(step.name, scope, cwd);
					if (res.code === 0) removed++;
					else {
						failed++;
						console.error(`Remove failed for ${step.name}: ${res.stderr}`);
					}
					continue;
				}
				// add/update/apply → одинаковый вызов add-json (идемпотентное ensure)
				let res = await addOrUpdateClaudeServer(step.name, step.json!, scope, cwd);
				if (res.code === 0) {
					if (step.action === "add") added++;
					else if (step.action === "update") updated++;
					else if (step.action === "apply") updated++;
				} else {
					// Если запись уже существует (user-scope), пробуем remove→add заново
					const msg = res.stderr.toLowerCase();
					if (msg.includes("already exists")) {
						// eslint-disable-next-line no-console
						console.warn(`[warn] ${step.name} exists; re-creating`);
						const rm = await removeClaudeServer(step.name, scope, cwd);
						if (rm.code === 0) {
							res = await addOrUpdateClaudeServer(step.name, step.json!, scope, cwd);
							if (res.code === 0) { updated++; continue; }
						}
						failed++;
						console.error(`${step.action.toUpperCase()} failed for ${step.name}: ${res.stderr}`);
					} else {
						failed++;
						console.error(`${step.action.toUpperCase()} failed for ${step.name}: ${res.stderr}`);
					}
				}
			}

			console.log(`Summary: added=${added} updated=${updated} removed=${removed} skipped=${skipped} failed=${failed}`);
			if (failed > 0) process.exitCode = 1;
		});
}
