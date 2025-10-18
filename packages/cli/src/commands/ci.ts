import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { type Lockfile, verifyLock } from "@katacut/core";
import type { Command } from "commander";
import { getAdapter } from "../lib/adapters/registry.js";

export function registerCiCommand(program: Command) {
	program
		.command("ci")
    .description("CI check: verify current state against katacut.lock.json for the selected client")
    .option("--client <id>", "Client id (default: claude-code)")
		.option("--file <path>", "Lockfile path (default: katacut.lock.json)")
		.action(async (opts: { client?: string; file?: string }) => {
			const clientId = opts.client ?? "claude-code";
			const adapter = await getAdapter(clientId);
				const cwd = process.cwd();
			const path = resolve(cwd, opts.file ?? "katacut.lock.json");
			const text = await readFile(path, "utf8");
			const lock = JSON.parse(text) as Lockfile;
			const project = await adapter.readProject(cwd);
			const user = await adapter.readUser();
      const report = verifyLock(lock, project, user);
      console.log(JSON.stringify(report, null, 2));
      if (report.status !== "ok") process.exitCode = 1;
    });
}
