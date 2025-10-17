import { createSyncPlan } from "@katacut/core";
import { parseConfig } from "@katacut/schema";
import { readConfigFile } from "@katacut/utils-fs";
import type { Command } from "commander";

export function registerSyncCommand(program: Command) {
	program
		.command("sync")
		.description("Синхронизировать конфигурацию KataCut с целевыми клиентами")
		.option("--dry-run", "показать план без применения", false)
		.option(
			"-c, --config <path>",
			"путь к katacut.config.jsonc",
			"katacut.config.jsonc",
		)
		.action(async (options: { dryRun?: boolean; config?: string }) => {
			const configPath = options.config ?? "katacut.config.jsonc";
			let source: string;
			try {
				source = await readConfigFile(configPath);
			} catch (error) {
				if ((error as NodeJS.ErrnoException).code === "ENOENT") {
					throw new Error(`Файл конфигурации не найден: ${configPath}`);
				}
				throw error;
			}
			const result = parseConfig(source);
			if (result.issues.length > 0 || !result.config) {
				for (const issue of result.issues) {
					// eslint-disable-next-line no-console
					console.error(`Ошибка конфига ${issue.path}: ${issue.message}`);
				}
				throw new Error("Конфигурация содержит ошибки, синхронизация прервана");
			}

			const plan = createSyncPlan(result.config);

			if (options.dryRun) {
				// eslint-disable-next-line no-console
				console.log("Dry-run план синхронизации:");
				// eslint-disable-next-line no-console
				console.log(JSON.stringify(plan, null, 2));
				return;
			}

			// TODO: применить план, вызвать адаптеры
			// eslint-disable-next-line no-console
			console.log("Пока применяется заглушечный план");
			// eslint-disable-next-line no-console
			console.log(JSON.stringify(plan, null, 2));
		});
}
