import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Command } from 'commander';

const TEMPLATE = `{
  "version": "0.1.0",
  "clients": {},
  "servers": {},
  "profiles": {
    "default": {
      "clients": [],
      "servers": []
    }
  },
  "secrets": {}
}
`;

export function registerInitCommand(program: Command) {
  program
    .command('init')
    .description('Create a baseline katacut.config.jsonc file')
    .option('-f, --force', 'overwrite existing configuration', false)
    .action(async (options: { force?: boolean }) => {
      const targetPath = resolve(process.cwd(), 'katacut.config.jsonc');
      if (!options.force) {
        try {
          await writeFile(targetPath, TEMPLATE, { flag: 'wx' });
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
            throw new Error('katacut.config.jsonc already exists (use --force to overwrite)');
          }
          throw error;
        }
      } else {
        await writeFile(targetPath, TEMPLATE, { flag: 'w' });
      }

      // eslint-disable-next-line no-console
      console.log(`Configuration file created: ${targetPath}`);
    });
}
