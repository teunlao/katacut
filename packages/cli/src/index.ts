#!/usr/bin/env node
import { Command } from "commander";
import { registerInitCommand } from "./commands/init.js";
import { registerSyncCommand } from "./commands/sync.js";
import { registerInstallCommand } from "./commands/install.js";
import { registerMcpCommand } from "./commands/mcp/index.js";
import { registerDoctorCommand } from "./commands/doctor.js";
import { registerLockCommand } from "./commands/lock.js";
import { registerCiCommand } from "./commands/ci.js";

const program = new Command();

program.name("katacut").description("Unified orchestration CLI for KataCut configurations").version("0.0.0");

registerInitCommand(program);
registerSyncCommand(program);
registerInstallCommand(program);
registerMcpCommand(program);
registerDoctorCommand(program);
registerLockCommand(program);
registerCiCommand(program);

program.parseAsync(process.argv).catch((error) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(1);
});
