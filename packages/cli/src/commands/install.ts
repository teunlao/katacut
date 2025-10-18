import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Scope } from "@katacut/core";
import { buildLock, diffDesiredCurrent, type Lockfile } from "@katacut/core";
import type { Command } from "commander";
import { getAdapter } from "../lib/adapters/registry.js";
import { loadAndValidateConfig } from "../lib/config.js";
import { appendProjectStateRun, buildStateEntries } from "../lib/state.js";
import { resolveFormatFlags } from "../lib/format.js";

export interface InstallOptions {
	readonly config?: string;
	readonly scope?: Scope;
	readonly client?: string;

	readonly dryRun?: boolean;
	readonly prune?: boolean;
	readonly writeLock?: boolean;
	readonly frozenLock?: boolean;
	readonly lockfileOnly?: boolean;
  readonly yes?: boolean;
  readonly json?: boolean;
  readonly noSummary?: boolean;
  readonly local?: boolean;
}

export function registerInstallCommand(program: Command) {
	program
		.command("install")
		.description("Install (apply) configuration to target client via MCP")
		.option("-c, --config <path>", "path to configuration file", undefined)
		.option("--scope <scope>", "Scope: user|project (default: project)")
		.option("--client <id>", "Client id (default: claude-code)")
		.option("--dry-run", "print plan without changes", false)
		.option("--prune", "remove servers not present in config", false)
		.option("--no-write-lock", "do not write katacut.lock.json after apply")
		.option("--frozen-lock", "require existing lock to match config and state; make no changes", false)
		.option("--lockfile-only", "generate/update lockfile without applying changes", false)
    .option("-y, --yes", "confirm destructive operations like --prune", false)
    .option("--json", "machine-readable output: only JSON plan (no tables, no labels)", false)
    .option("--no-summary", "suppress human tables and labels; keep JSON only where applicable", false)
    .option("--local", "apply locally only (do not touch config/lock); record state as local intent", false)
		.action(async (options: InstallOptions) => {
			const cwd = process.cwd();

			const clientId = options.client ?? "claude-code";
			const adapter = await getAdapter(clientId);
			if (!(await adapter.checkAvailable?.())) {
				throw new Error("Claude CLI is not available in PATH. Please install and try again.");
			}

			const config = await loadAndValidateConfig(options.config);
			const requestedScope: Scope = options.scope === "user" ? "user" : "project";

			const desired = adapter.desiredFromConfig(config);

			// Resolve realized scope using adapter capabilities (prefer project, allow emulation if available)
			let scope: Scope = requestedScope;
			const caps = (await adapter.capabilities?.()) ?? {
				supportsProject: true,
				supportsUser: true,
				emulateProjectWithUser: false,
				supportsGlobalExplicit: false,
			};
			if (requestedScope === "project" && !caps.supportsProject) {
				if (caps.emulateProjectWithUser && caps.supportsUser) {
					scope = "user";
					console.log("Note: adapter does not support project scope; applying in user scope (emulated project).");
				} else {
					throw new Error("Adapter does not support project scope and emulation is not allowed.");
				}
			}

			// Prepare expected lock from desired state (for realized scope)
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

      // Print plan
      const fmt = resolveFormatFlags(process.argv, { json: options.json, noSummary: options.noSummary });
      if (!fmt.json && !fmt.noSummary) console.log("Plan:");
      console.log(JSON.stringify(plan, null, 2));
      if (!fmt.json && !fmt.noSummary) printPlanTable(plan, scope);

      // Safety: require --yes for --prune to avoid accidental removals
      if (options.prune && !options.yes) {
        console.error("Refusing to prune without confirmation. Re-run with --yes to proceed.");
        process.exitCode = 1;
        return;
      }

      if (options.local && options.prune) {
        console.error("--local cannot be used together with --prune. Remove entries via 'kc mcp remove --local' or run project install without --local.");
        process.exitCode = 1;
        return;
      }

			if (options.dryRun) return;

			let skipped = 0;
			for (const step of plan) if (step.action === "skip") skipped++;
			const applyPlan = plan
				.filter((p) => p.action !== "skip")
				.map((p) => ({ action: p.action as "add" | "update" | "remove", name: p.name, json: p.json }));
      const summary = await adapter.applyInstall(applyPlan, scope, cwd);
      if (!fmt.json && !fmt.noSummary) {
        console.log(
          `Summary: added=${summary.added} updated=${summary.updated} removed=${summary.removed} skipped=${skipped} failed=${summary.failed}`,
        );
        printSummaryTable(summary, skipped);
      }
			if (summary.failed > 0) {
				process.exitCode = 1;
				return;
			}

      // Record state for diagnostics
      const mode: "native" | "emulated" = scope === requestedScope ? "native" : "emulated";
      const stateEntries = buildStateEntries(plan, desired, current.mcpServers, scope);
      await appendProjectStateRun(cwd, {
        at: new Date().toISOString(),
        client: adapter.id,
        requestedScope,
        realizedScope: scope,
        mode,
        intent: options.local ? "local" : "project",
        result: summary,
        entries: stateEntries,
      });

      // Write lock by default (unless suppressed) after successful apply (skip when --local)
      if (!options.local && options.writeLock !== false) {
        await writeFile(lockPath, JSON.stringify(expectedLock, null, 2), "utf8");
        console.log(`Updated lockfile: ${lockPath}`);
      }
		});
}

type PlanItem = { readonly action: string; readonly name: string };
function printPlanTable(plan: readonly PlanItem[], scope: Scope) {
	const headers: readonly string[] = ["Name", "Action", "Scope"];
	const rows: readonly (readonly string[])[] = plan.map((p) => [p.name, p.action.toUpperCase(), String(scope)] as const);
	renderTable(headers, rows);
}

function printSummaryTable(
	summary: { added: number; updated: number; removed: number; failed: number },
	skipped: number,
) {
	const headers: readonly string[] = ["Added", "Updated", "Removed", "Skipped", "Failed"];
	const rows: readonly (readonly string[])[] = [[
		String(summary.added),
		String(summary.updated),
		String(summary.removed),
		String(skipped),
		String(summary.failed),
	]];
	renderTable(headers, rows);
}

function renderTable(headers: readonly string[], rows: readonly (readonly string[])[]) {
	const widths = headers.map((h, i) => Math.max(h.length, ...rows.map((r) => (r[i] ?? "").length)));
	const line = (cols: readonly string[]) => cols.map((c, i) => c.padEnd(widths[i], " ")).join("  |  ");
	console.log(line(headers));
	console.log(widths.map((w) => "".padEnd(w, "-")).join("--+--"));
	for (const r of rows) console.log(line(r));
}
