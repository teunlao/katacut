import { resolve } from 'node:path';

import { createSyncPlan, DEFAULT_CONFIG_FILENAMES, resolveConfigPath } from '@katacut/core';
import { parseConfig } from '@katacut/schema';
import { readConfigFile } from '@katacut/utils';
import type { Command } from 'commander';

export function registerSyncCommand(program: Command) {
	program
		.command('sync')
		.description('Synchronize KataCut configuration with target clients')
		.option('--dry-run', 'print the plan without applying changes', false)
		.option(
			'-c, --config <path>',
			'path to configuration file (defaults to katacut.config.jsonc / katacut.config.json / katacut.jsonc / katacut.json)',
		)
		.action(async (options: { dryRun?: boolean; config?: string }) => {
			const cwd = process.cwd();
			const explicitConfigPath = options.config ? resolve(cwd, options.config) : undefined;
			const discoveredPath = explicitConfigPath ?? (await resolveConfigPath({ cwd }));

			if (!discoveredPath) {
				throw new Error(`Configuration file not found. Checked: ${DEFAULT_CONFIG_FILENAMES.join(', ')}`);
			}

			const configPath = discoveredPath;
			let source: string;
			try {
				source = await readConfigFile(configPath);
			} catch (error) {
				if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
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
				throw new Error('Configuration contains errors; synchronization aborted');
			}

			const plan = createSyncPlan(result.config);

			if (options.dryRun) {
				console.log('Dry-run synchronization plan:');
				console.log(JSON.stringify(plan, null, 2));
				return;
			}

			// TODO: apply plan and call adapters
			console.log('Applying placeholder plan');
			console.log(JSON.stringify(plan, null, 2));
		});
}
