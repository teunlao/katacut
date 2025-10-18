import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { InstallStep, ServerJson } from "@katacut/core";
import { Command } from "commander";
import { describe, expect, it, vi } from "vitest";

describe("kc mcp remove (default)", () => {
	it("edits config, prunes state, updates lock and writes project state", async () => {
		const dir = await mkdtemp(join(tmpdir(), "kc-remove-def-"));
		try {
			const cfg = {
				version: "0.1.0",
				mcp: { keep: { transport: "http", url: "https://k" }, del: { transport: "http", url: "https://d" } },
			} as const;
			await writeFile(join(dir, "katacut.config.jsonc"), JSON.stringify(cfg), "utf8");
			await writeFile(
				join(dir, ".mcp.json"),
				JSON.stringify({
					mcpServers: { keep: { type: "http", url: "https://k" }, del: { type: "http", url: "https://d" } },
				}),
				"utf8",
			);

			vi.resetModules();
			vi.doMock("../../src/lib/adapters/registry.ts", () => {
				const adapter = {
					id: "claude-code",
					checkAvailable: async () => true,
					readProject: async () => ({
						mcpServers: { keep: { type: "http", url: "https://k" }, del: { type: "http", url: "https://d" } },
					}),
					readUser: async () => ({ mcpServers: {} }),
					desiredFromConfig: (c: unknown): Record<string, ServerJson> => {
						const o = c as { mcp: Record<string, { transport: string; url?: string; command?: string }> };
						const out: Record<string, ServerJson> = {};
						for (const [k, v] of Object.entries(o.mcp))
							out[k] =
								v.transport === "http"
									? { type: "http", url: String(v.url ?? "") }
									: { type: "stdio", command: String(v.command ?? "") };
						return out;
					},
					applyInstall: async (plan: readonly InstallStep[], _scope: "project" | "user") => {
						// emulate prune remove of 'del'
						const removed = plan.filter((p) => p.action === "remove").length;
						return { added: 0, updated: 0, removed, failed: 0 };
					},
				} as const;
				return { getAdapter: async () => adapter };
			});

			const { registerMcpCommand } = await import("../src/commands/mcp/index.ts");
			const program = new Command();
			registerMcpCommand(program);
			const cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(dir);
			await program.parseAsync(
				["node", "cli", "mcp", "remove", "del", "--client", "claude-code", "--scope", "project"],
				{ from: "node" },
			);
			cwdSpy.mockRestore();

			// Config edited: 'del' removed
			const cfgText = await readFile(join(dir, "katacut.config.jsonc"), "utf8");
			expect(cfgText.includes('"del"')).toBe(false);
			// Lock exists
			const stLock = await stat(join(dir, "katacut.lock.json"));
			expect(stLock.isFile()).toBe(true);
			// State has intent=project
			const stateText = await readFile(join(dir, ".katacut", "state.json"), "utf8");
			const state = JSON.parse(stateText);
			expect(state.runs[0].intent).toBe("project");
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});
});
