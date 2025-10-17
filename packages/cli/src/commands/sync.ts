import { createSyncPlan } from "@katacut/core";
import { parseConfig } from "@katacut/schema";
import { readConfigFile } from "@katacut/utils";
import type { Command } from "commander";

export function registerSyncCommand(program: Command) {
	program
		.command("sync")
		.description("Synchronize KataCut configuration with target clients")
		.option("--dry-run", "print the plan without applying changes", false)
		.option(
			"-c, --config <path>",
			"path to katacut.config.jsonc",
			"katacut.config.jsonc",
		)
		.action(async (options: { dryRun?: boolean; config?: string }) => {
			const configPath = options.config ?? "katacut.config.jsonc";
			let source: string;
			try {
				source = await readConfigFile(configPath);
			} catch (error) {
				if ((error as NodeJS.ErrnoException).code === "ENOENT") {
					throw new Error(`Configuration file not found: ${configPath}`);
				}
				throw error;
			}
			const result = parseConfig(source);
			if (result.issues.length > 0 || !result.config) {
				for (const issue of result.issues) {
					// eslint-disable-next-line no-console
					console.error(`Config error at ${issue.path}: ${issue.message}`);
				}
				throw new Error("Configuration contains errors; synchronization aborted");
			}

			const plan = createSyncPlan(result.config);

			if (options.dryRun) {
				// eslint-disable-next-line no-console
				console.log("Dry-run synchronization plan:");
				// eslint-disable-next-line no-console
				console.log(JSON.stringify(plan, null, 2));
				return;
			}

			// TODO: apply plan and call adapters
			// eslint-disable-next-line no-console
			console.log("Applying placeholder plan");
			// eslint-disable-next-line no-console
			console.log(JSON.stringify(plan, null, 2));
		});
}
