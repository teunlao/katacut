import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Scope } from "@katacut/core";
import { buildLock, diffDesiredCurrent, type Lockfile } from "@katacut/core";
import type { Command } from "commander";
import { getAdapter } from "../lib/adapters/registry.js";
import { loadAndValidateConfig } from "../lib/config.js";
import { resolveFormatFlags } from "../lib/format.js";
import { buildSummaryLine, printTableSection } from "../lib/print.js";
import { appendProjectStateRun, buildStateEntries } from "../lib/state.js";

export interface InstallOptions {
	readonly config?: string;
	readonly scope?: Scope;
	readonly client?: string;

	readonly dryRun?: boolean;
	readonly prune?: boolean;
	readonly writeLock?: boolean;
	readonly frozenLock?: boolean;
	readonly frozenLockfile?: boolean;
	readonly fromLock?: boolean;
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
		.option("--frozen-lock", "require existing lock to match config (alias of --frozen-lockfile)", false)
		.option("--frozen-lockfile", "require existing lock to match config; if matches, apply strictly from lock and do not write lockfile", false)
		.option("--lockfile-only", "generate/update lockfile without applying changes", false)
		.option("--from-lock", "apply strictly from lockfile (ignore config)", false)
		.option("-y, --yes", "confirm destructive operations like --prune", false)
		.option("--json", "machine-readable output: only JSON plan (no tables, no labels)", false)
		.option("--no-summary", "suppress human tables and labels; keep JSON only where applicable", false)
		.option("--local", "apply locally only (do not touch config/lock); record state as local intent", false)
		.action(async (options: InstallOptions) => {
			const cwd = process.cwd();

			const clientId = options.client ?? "claude-code";
			const adapter = await getAdapter(clientId);
			const config = await loadAndValidateConfig(options.config);
			const requestedScope: Scope = options.scope === "user" ? "user" : "project";

			// Lockfile-only: generate/refresh lock strictly from desired state without apply
			if (options.lockfileOnly) {
				const desiredForLock = adapter.desiredFromConfig(config);
				const expectedLock: Lockfile = buildLock(adapter.id, desiredForLock, requestedScope);
				const lockPath = resolve(process.cwd(), "katacut.lock.json");
				if (options.frozenLock || options.frozenLockfile) {
					try {
						const text = await readFile(lockPath, "utf8");
						const currentLock = JSON.parse(text) as Lockfile;
						const sameClient = currentLock.client === expectedLock.client;
						const sameEntries = JSON.stringify(currentLock.mcpServers) === JSON.stringify(expectedLock.mcpServers);
						if (!sameClient || !sameEntries) {
							console.error("Frozen lock mismatch: lockfile is not up to date with configuration.");
							process.exitCode = 1;
						}
						return; // do not write in frozen mode
					} catch {
						console.error("Frozen lock mismatch: lockfile is missing or unreadable.");
						process.exitCode = 1;
						return;
					}
				}
				try {
					const text = await readFile(lockPath, "utf8");
					const prev = JSON.parse(text) as Lockfile;
					const { mergeLock } = await import("@katacut/core");
					const merged = mergeLock(prev, expectedLock);
					await writeFile(lockPath, JSON.stringify(merged, null, 2), "utf8");
					console.log(`Wrote lockfile: ${lockPath}`);
				} catch {
					await writeFile(lockPath, JSON.stringify(expectedLock, null, 2), "utf8");
					console.log(`Wrote lockfile: ${lockPath}`);
				}
				return;
			}

			// Frozen-lockfile: validate lock against desired; if match → apply strictly from lock; never write lock
			const frozen = Boolean(options.frozenLock || options.frozenLockfile);
			if (frozen) {
				const desiredForLock = adapter.desiredFromConfig(config);
				const expectedLockEarly: Lockfile = buildLock(adapter.id, desiredForLock, requestedScope);
				const lockPathEarly = resolve(cwd, "katacut.lock.json");
				let currentLock: Lockfile | undefined;
				try {
					const text = await readFile(lockPathEarly, "utf8");
					currentLock = JSON.parse(text) as Lockfile;
					const sameClient = currentLock.client === expectedLockEarly.client;
					const sameEntries = JSON.stringify(currentLock.mcpServers) === JSON.stringify(expectedLockEarly.mcpServers);
					if (!sameClient || !sameEntries) {
						console.error("Frozen lock mismatch: lockfile is not up to date with configuration.");
						process.exitCode = 1;
						return;
					}
				} catch {
					console.error("Frozen lock mismatch: lockfile is missing or unreadable.");
					process.exitCode = 1;
					return;
				}
				// Apply from lock without writing lockfile
				const desiredFromLock: Record<string, import("@katacut/core").ServerJson> = {};
				for (const [name, entry] of Object.entries(currentLock.mcpServers)) {
					if (entry.scope === requestedScope && entry.snapshot) desiredFromLock[name] = entry.snapshot;
				}
				const currentState = requestedScope === "project" ? await adapter.readProject(cwd) : await adapter.readUser();
				const planFromLock = diffDesiredCurrent(
					desiredFromLock,
					currentState.mcpServers,
					Boolean(options.prune),
					true,
				);
				const fmtF = resolveFormatFlags(process.argv, { json: options.json, noSummary: options.noSummary });
				console.log(JSON.stringify(planFromLock, null, 2));
				printTableSection(
					"Plan",
					["Name", "Action", "Scope"],
					planFromLock.map((p) => [p.name, p.action.toUpperCase(), String(requestedScope)] as const),
					fmtF,
				);
				if (options.dryRun) return;
				let skippedL = 0;
				for (const s of planFromLock) if (s.action === "skip") skippedL++;
				const applyPlanL = planFromLock
					.filter((p) => p.action !== "skip")
					.map((p) => ({ action: p.action as "add" | "update" | "remove", name: p.name, json: p.json }));
				if (applyPlanL.length === 0) {
					if (!fmtF.json && !fmtF.noSummary) console.log(buildSummaryLine({ added: 0, updated: 0, removed: 0, failed: 0 }, skippedL));
					printTableSection(
						"Summary",
						["Added", "Updated", "Removed", "Skipped", "Failed"],
						[["0", "0", "0", String(skippedL), "0"]],
						fmtF,
					);
					return;
				}
				const summaryL = await adapter.applyInstall(applyPlanL, requestedScope, cwd);
				if (!fmtF.json && !fmtF.noSummary) console.log(buildSummaryLine(summaryL, skippedL));
				printTableSection(
					"Summary",
					["Added", "Updated", "Removed", "Skipped", "Failed"],
					[[String(summaryL.added), String(summaryL.updated), String(summaryL.removed), String(skippedL), String(summaryL.failed)]],
					fmtF,
				);
				if (summaryL.failed > 0) process.exitCode = 1;
				return;
			}

			if (!(await adapter.checkAvailable?.())) {
				throw new Error(`${adapter.id} CLI is not available in PATH. Please install and try again.`);
			}

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

			// From-lock: apply strictly from lock snapshots for selected scope
			if (options.fromLock) {
				try {
					const text = await readFile(lockPath, "utf8");
					const currentLock = JSON.parse(text) as Lockfile;
					if (currentLock.client !== adapter.id) {
						console.error("Lockfile client does not match selected client.");
						process.exitCode = 1;
						return;
					}
					const desiredFromLock: Record<string, import("@katacut/core").ServerJson> = {};
					for (const [name, entry] of Object.entries(currentLock.mcpServers)) {
						if (entry.scope === scope) {
							const snap = entry.snapshot;
							if (!snap) {
								console.error(`Lock entry '${name}' has no snapshot; cannot --from-lock.`);
								process.exitCode = 1;
								return;
							}
							desiredFromLock[name] = snap;
						}
					}
					const currentState = scope === "project" ? await adapter.readProject(cwd) : await adapter.readUser();
					const planFromLock = diffDesiredCurrent(
						desiredFromLock,
						currentState.mcpServers,
						Boolean(options.prune),
						true,
					);
					const fmt = resolveFormatFlags(process.argv, { json: options.json, noSummary: options.noSummary });
					console.log(JSON.stringify(planFromLock, null, 2));
					printTableSection(
						"Plan",
						["Name", "Action", "Scope"],
						planFromLock.map((p) => [p.name, p.action.toUpperCase(), String(scope)] as const),
						fmt,
					);
					if (options.dryRun) return;
					// If frozen-lockfile was requested, we've already validated; do not apply
					if (options.frozenLock || options.frozenLockfile) return;
					let skippedL = 0;
					for (const s of planFromLock) if (s.action === "skip") skippedL++;
					const applyPlanL = planFromLock
						.filter((p) => p.action !== "skip")
						.map((p) => ({ action: p.action as "add" | "update" | "remove", name: p.name, json: p.json }));
					if (applyPlanL.length === 0) {
						if (!fmt.json && !fmt.noSummary) console.log(buildSummaryLine({ added: 0, updated: 0, removed: 0, failed: 0 }, skippedL));
						printTableSection(
							"Summary",
							["Added", "Updated", "Removed", "Skipped", "Failed"],
							[["0", "0", "0", String(skippedL), "0"]],
							fmt,
						);
						return;
					}
					const summaryL = await adapter.applyInstall(applyPlanL, scope, cwd);
					if (!fmt.json && !fmt.noSummary) console.log(buildSummaryLine(summaryL, skippedL));
					printTableSection(
						"Summary",
						["Added", "Updated", "Removed", "Skipped", "Failed"],
						[
							[
								String(summaryL.added),
								String(summaryL.updated),
								String(summaryL.removed),
								String(skippedL),
								String(summaryL.failed),
							],
						],
						fmt,
					);
					if (summaryL.failed > 0) process.exitCode = 1;
					return;
				} catch {
					console.error("Lockfile is missing or unreadable.");
					process.exitCode = 1;
					return;
				}
			}

			const current = scope === "project" ? await adapter.readProject(cwd) : await adapter.readUser();
			const plan = diffDesiredCurrent(desired, current.mcpServers, Boolean(options.prune), true);

			// Print plan
			const fmt = resolveFormatFlags(process.argv, { json: options.json, noSummary: options.noSummary });
			console.log(JSON.stringify(plan, null, 2));
			printTableSection(
				"Plan",
				["Name", "Action", "Scope"],
				plan.map((p) => [p.name, p.action.toUpperCase(), String(scope)] as const),
				fmt,
			);

			// Safety: require --yes for --prune to avoid accidental removals
			if (options.prune && !options.yes) {
				console.error("Refusing to prune without confirmation. Re-run with --yes to proceed.");
				process.exitCode = 1;
				return;
			}

			if (options.local && options.prune) {
				console.error(
					"--local cannot be used together with --prune. Remove entries via 'kc mcp remove --local' or run project install without --local.",
				);
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
			if (!fmt.json && !fmt.noSummary) console.log(buildSummaryLine(summary, skipped));
			printTableSection(
				"Summary",
				["Added", "Updated", "Removed", "Skipped", "Failed"],
				[
					[
						String(summary.added),
						String(summary.updated),
						String(summary.removed),
						String(skipped),
						String(summary.failed),
					],
				],
				fmt,
			);
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
				try {
					const prevText = await readFile(lockPath, "utf8");
					const prev = JSON.parse(prevText) as Lockfile;
					const { mergeLock } = await import("@katacut/core");
					const merged = mergeLock(prev, expectedLock);
					await writeFile(lockPath, JSON.stringify(merged, null, 2), "utf8");
					console.log(`Updated lockfile: ${lockPath}`);
				} catch {
					await writeFile(lockPath, JSON.stringify(expectedLock, null, 2), "utf8");
					console.log(`Updated lockfile: ${lockPath}`);
				}
			}
		});
}
