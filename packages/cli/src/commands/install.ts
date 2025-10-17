import type { Scope } from "@katacut/core";
import { diffDesiredCurrent, buildLock, type Lockfile } from "@katacut/core";
import type { Command } from "commander";
import { getAdapter } from "../lib/adapters/registry.js";
import { loadAndValidateConfig } from "../lib/config.js";
import { resolve } from "node:path";
import { readFile, writeFile } from "node:fs/promises";

export interface InstallOptions {
	readonly config?: string;
	readonly scope?: Scope;
	readonly client?: string;

	readonly dryRun?: boolean;
	readonly prune?: boolean;
  readonly writeLock?: boolean;
  readonly frozenLock?: boolean;
  readonly lockfileOnly?: boolean;
}

export function registerInstallCommand(program: Command) {
	program
		.command("install")
		.description("Install (apply) configuration to target client via MCP")
		.option("-c, --config <path>", "path to configuration file", undefined)
		.option("--scope <scope>", "Scope: user|project (default: user)")
		.option("--client <id>", "Client id (default: claude-code)")
		.option("--dry-run", "print plan without changes", false)
		.option("--prune", "remove servers not present in config", false)
		.option("--no-write-lock", "do not write katacut.lock.json after apply")
		.option("--frozen-lock", "require existing lock to match config and state; make no changes", false)
		.option("--lockfile-only", "generate/update lockfile without applying changes", false)
		.action(async (options: InstallOptions) => {
			const cwd = process.cwd();

			const clientId = options.client ?? "claude-code";
			const adapter = await getAdapter(clientId);
			if (!(await adapter.checkAvailable?.())) {
				throw new Error("Claude CLI is not available in PATH. Please install and try again.");
			}

			const config = await loadAndValidateConfig(options.config);
			const scope: Scope = options.scope === "project" ? "project" : "user";

			const desired = adapter.desiredFromConfig(config);

      // Prepare expected lock from desired state
      const expectedLock: Lockfile = buildLock(adapter.id, desired, scope);
      const lockPath = resolve(cwd, "katacut.lock.json");

      // Frozen lock: require existing lock to match desired, otherwise exit with code 1
      if (options.frozenLock) {
        try {
          const text = await readFile(lockPath, "utf8");
          const currentLock = JSON.parse(text) as Lockfile;
          const sameClient = currentLock.client === expectedLock.client;
          const sameEntries = JSON.stringify(currentLock.mcpServers) === JSON.stringify(expectedLock.mcpServers);
          if (!sameClient || !sameEntries) {
            console.error("Frozen lock mismatch: lockfile does not match desired configuration.");
            process.exitCode = 1;
            return;
          }
        } catch {
          console.error("Frozen lock mismatch: lockfile is missing or unreadable.");
          process.exitCode = 1;
          return;
        }
      }

      // Lockfile-only: write lock and exit without applying
      if (options.lockfileOnly) {
        await writeFile(lockPath, JSON.stringify(expectedLock, null, 2), "utf8");
        console.log(`Wrote lockfile: ${lockPath}`);
        return;
      }

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
			if (summary.failed > 0) { process.exitCode = 1; return; }

      // Write lock by default (unless suppressed) after successful apply
      if (options.writeLock !== false) {
        await writeFile(lockPath, JSON.stringify(expectedLock, null, 2), "utf8");
        console.log(`Updated lockfile: ${lockPath}`);
      }
		});
}
