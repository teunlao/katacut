import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Command } from "commander";
import { describe, expect, it, vi } from "vitest";

describe("kc mcp add <registry url>", () => {
	it("normalizes remotes(http) from registry entry and applies", async () => {
		const dir = await mkdtemp(join(tmpdir(), "kc-add-reg-http-"));
		try {
			await writeFile(join(dir, "katacut.config.jsonc"), JSON.stringify({ version: "0.1.0", mcp: {} }), "utf8");
			await writeFile(join(dir, ".mcp.json"), JSON.stringify({ mcpServers: {} }), "utf8");

			vi.resetModules();
			vi.doMock("../../src/lib/adapters/registry.ts", () => {
				const adapter = {
					id: "claude-code",
					checkAvailable: async () => true,
					readProject: async () => ({ mcpServers: {} }),
					readUser: async () => ({ mcpServers: {} }),
					desiredFromConfig: (c: unknown) => {
						const o = c as {
							mcp: Record<
								string,
								{ transport: string; url?: string; command?: string; args?: string[]; env?: Record<string, string> }
							>;
						};
						const out: Record<
							string,
							{ type: "http" | "stdio"; url?: string; command?: string; args?: string[]; env?: Record<string, string> }
						> = {};
						for (const [k, v] of Object.entries(o.mcp))
							out[k] =
								v.transport === "http"
									? { type: "http", url: String(v.url ?? "") }
									: { type: "stdio", command: String(v.command ?? ""), args: v.args, env: v.env };
						return out;
					},
					applyInstall: async (plan: readonly { action: "add" | "update" | "remove"; name: string }[]) => {
						const added = plan.filter((p) => p.action === "add").length;
						const updated = plan.filter((p) => p.action === "update").length;
						return { added, updated, removed: 0, failed: 0 };
					},
				} as const;
				return { getAdapter: async () => adapter };
			});

			// Mock registry response with remotes http
			const registryJson = {
				server: {
					name: "ai.smithery/Hint-Services-obsidian-github-mcp",
					version: "0.4.0",
					remotes: [
						{
							type: "streamable-http",
							url: "https://example.org/mcp",
							headers: [{ name: "Authorization", value: "Bearer token" }],
						},
					],
					packages: null,
				},
				_meta: { published_at: "2025-10-17T00:00:00Z" },
			} as const;
			const fetchMock = vi.fn(
				async () =>
					new Response(JSON.stringify(registryJson), { status: 200, headers: { "content-type": "application/json" } }),
			);
			global.fetch = fetchMock;

			const { registerMcpCommand } = await import("../src/commands/mcp/index.ts");
			const program = new Command();
			registerMcpCommand(program);
			const cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(dir);
			await program.parseAsync(
				[
					"node",
					"cli",
					"mcp",
					"add",
					"https://registry.modelcontextprotocol.io/v0.1/servers/ai.smithery%2FHint-Services-obsidian-github-mcp/versions/latest",
				],
				{ from: "node" },
			);
			cwdSpy.mockRestore();

			const cfg = JSON.parse(await readFile(join(dir, "katacut.config.jsonc"), "utf8")) as {
				mcp: Record<string, unknown>;
			};
			// name part after slash
			expect(Object.keys(cfg.mcp)).toContain("Hint-Services-obsidian-github-mcp");
			const stLock = await stat(join(dir, "katacut.lock.json"));
			expect(stLock.isFile()).toBe(true);
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});

	it("normalizes packages(stdio) from registry entry and applies", async () => {
		const dir = await mkdtemp(join(tmpdir(), "kc-add-reg-stdio-"));
		try {
			await writeFile(join(dir, "katacut.config.jsonc"), JSON.stringify({ version: "0.1.0", mcp: {} }), "utf8");
			await writeFile(join(dir, ".mcp.json"), JSON.stringify({ mcpServers: {} }), "utf8");

			vi.resetModules();
			vi.doMock("../../src/lib/adapters/registry.ts", () => {
				const adapter = {
					id: "claude-code",
					checkAvailable: async () => true,
					readProject: async () => ({ mcpServers: {} }),
					readUser: async () => ({ mcpServers: {} }),
					desiredFromConfig: (c: unknown) => {
						const o = c as {
							mcp: Record<
								string,
								{ transport: string; url?: string; command?: string; args?: string[]; env?: Record<string, string> }
							>;
						};
						const out: Record<
							string,
							{ type: "http" | "stdio"; url?: string; command?: string; args?: string[]; env?: Record<string, string> }
						> = {};
						for (const [k, v] of Object.entries(o.mcp))
							out[k] =
								v.transport === "http"
									? { type: "http", url: String(v.url ?? "") }
									: { type: "stdio", command: String(v.command ?? ""), args: v.args, env: v.env };
						return out;
					},
					applyInstall: async (plan: readonly { action: "add" | "update" | "remove"; name: string }[]) => {
						const added = plan.filter((p) => p.action === "add").length;
						const updated = plan.filter((p) => p.action === "update").length;
						return { added, updated, removed: 0, failed: 0 };
					},
				} as const;
				return { getAdapter: async () => adapter };
			});

			// Mock registry response with stdio package
			const registryJson = {
				server: {
					name: "io.modelcontextprotocol/server-memory",
					version: "1.0.0",
					remotes: null,
					packages: [
						{
							registryType: "npm",
							identifier: "@modelcontextprotocol/server-memory",
							transport: { type: "stdio" },
							runtimeHint: "npx",
						},
					],
				},
				_meta: { published_at: "2025-10-17T00:00:00Z" },
			} as const;
			const fetchMock = vi.fn(
				async () =>
					new Response(JSON.stringify(registryJson), { status: 200, headers: { "content-type": "application/json" } }),
			);
			global.fetch = fetchMock;

			const { registerMcpCommand } = await import("../src/commands/mcp/index.ts");
			const program = new Command();
			registerMcpCommand(program);
			const cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(dir);
			await program.parseAsync(
				[
					"node",
					"cli",
					"mcp",
					"add",
					"https://registry.modelcontextprotocol.io/v0.1/servers/io.modelcontextprotocol%2Fserver-memory/versions/latest",
				],
				{ from: "node" },
			);
			cwdSpy.mockRestore();

			const cfg = JSON.parse(await readFile(join(dir, "katacut.config.jsonc"), "utf8")) as {
				mcp: Record<string, unknown>;
			};
			expect(Object.keys(cfg.mcp)).toContain("server-memory");
			const stLock = await stat(join(dir, "katacut.lock.json"));
			expect(stLock.isFile()).toBe(true);
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});
});
