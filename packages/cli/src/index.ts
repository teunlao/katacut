#!/usr/bin/env node
import { Command } from 'commander';
import { registerInitCommand } from './commands/init.js';
import { registerSyncCommand } from './commands/sync.js';

const program = new Command();

program
  .name('katacut')
  .description('Unified orchestration CLI for KataCut configurations')
  .version('0.0.0');

registerInitCommand(program);
registerSyncCommand(program);

program.parseAsync(process.argv).catch(error => {
  // eslint-disable-next-line no-console
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
