import { resolve } from "node:path";
import { buildLock, type Lockfile, type Scope, verifyLock } from "@katacut/core";
import type { Command } from "commander";
import { getAdapter } from "../lib/adapters/registry.js";
import { loadAndValidateConfig } from "../lib/config.js";

export function registerLockCommand(program: Command) {
	const cmd = program.command("lock").description("Lockfile utilities");

	cmd
		.command("generate")
		.description("Generate lockfile from config for a client")
		.option("-c, --config <path>", "path to configuration file")
		.option("--client <id>", "Client id (default: claude-code)")
		.option("--scope <scope>", "Scope for desired servers (default: project)")
		.option("--out <path>", "Write lockfile to path (if omitted, prints to stdout)")
		.action(async (opts: { config?: string; client?: string; scope?: Scope; out?: string }) => {
			const clientId = opts.client ?? "claude-code";
			const adapter = await getAdapter(clientId);
			const config = await loadAndValidateConfig(opts.config);
			const desired = adapter.desiredFromConfig(config);
			const scope: Scope = opts.scope === "user" ? "user" : "project";
			const lock = buildLock(adapter.id, desired, scope);
			if (opts.out) {
				const path = resolve(process.cwd(), opts.out);
				await (await import("node:fs/promises")).writeFile(path, JSON.stringify(lock, null, 2), "utf8");
				console.log(`Wrote lockfile: ${path}`);
			} else {
				console.log(JSON.stringify(lock, null, 2));
			}
		});

	cmd
		.command("verify")
		.description("Verify current state against lockfile")
		.option("--file <path>", "Lockfile path (default: katacut.lock.json)")
		.option("--client <id>", "Client id (default: claude-code)")
		.action(async (opts: { file?: string; client?: string }) => {
			const clientId = opts.client ?? "claude-code";
			const adapter = await getAdapter(clientId);
			const path = resolve(process.cwd(), opts.file ?? "katacut.lock.json");
			const text = await (await import("node:fs/promises")).readFile(path, "utf8");
			const lock = JSON.parse(text) as Lockfile;
			const project = await adapter.readProject(process.cwd());
			const user = await adapter.readUser();
			const report = verifyLock(lock, project, user);
			console.log(JSON.stringify(report, null, 2));
			if (report.status !== "ok") process.exitCode = 1;
		});
}
