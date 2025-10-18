import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Command } from "commander";
import { describe, expect, it, vi } from "vitest";

describe("kc mcp add <name>[@version] via registry", () => {
	it("resolves name without version as latest and applies", async () => {
		const dir = await mkdtemp(join(tmpdir(), "kc-add-name-"));
		try {
			await writeFile(join(dir, "katacut.config.jsonc"), JSON.stringify({ version: "0.1.0", mcp: {} }), "utf8");
			await writeFile(join(dir, ".mcp.json"), JSON.stringify({ mcpServers: {} }), "utf8");

			vi.resetModules();
			// Mock adapter
			vi.doMock("../src/lib/adapters/registry.ts", () => {
				const adapter = {
					id: "claude-code",
					checkAvailable: async () => true,
					readProject: async () => ({ mcpServers: {} }),
					readUser: async () => ({ mcpServers: {} }),
					desiredFromConfig: (c: unknown) => {
						const o = c as {
							mcp: Record<string, { transport: string; url?: string; command?: string; args?: string[] }>;
						};
						const out: Record<string, { type: "http" | "stdio"; url?: string; command?: string; args?: string[] }> = {};
						for (const [k, v] of Object.entries(o.mcp))
							out[k] =
								v.transport === "http"
									? { type: "http", url: v.url }
									: { type: "stdio", command: String(v.command), args: v.args };
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

			// Mock registry fetch for name
			const payload = {
				server: {
					name: "com.example/my-server",
					remotes: [{ type: "http", url: "https://api.example.com/mcp" }],
				},
			} as const;
			const fetchMock = vi.fn(
				async () =>
					new Response(JSON.stringify(payload), { status: 200, headers: { "content-type": "application/json" } }),
			);
			global.fetch = fetchMock;

			const { registerMcpCommand } = await import("../src/commands/mcp/index.ts");
			const program = new Command();
			registerMcpCommand(program);
			const cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(dir);
			await program.parseAsync(["node", "cli", "mcp", "add", "com.example/my-server"], { from: "node" });
			cwdSpy.mockRestore();

			const cfg = JSON.parse(await readFile(join(dir, "katacut.config.jsonc"), "utf8")) as {
				mcp: Record<string, unknown>;
			};
			expect(Object.keys(cfg.mcp)).toContain("my-server");
			const stLock = await stat(join(dir, "katacut.lock.json"));
			expect(stLock.isFile()).toBe(true);
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});

	it("resolves name with explicit version", async () => {
		const dir = await mkdtemp(join(tmpdir(), "kc-add-name-ver-"));
		try {
			await writeFile(join(dir, "katacut.config.jsonc"), JSON.stringify({ version: "0.1.0", mcp: {} }), "utf8");
			await writeFile(join(dir, ".mcp.json"), JSON.stringify({ mcpServers: {} }), "utf8");

			vi.resetModules();
			vi.doMock("../src/lib/adapters/registry.ts", () => {
				const adapter = {
					id: "claude-code",
					checkAvailable: async () => true,
					readProject: async () => ({ mcpServers: {} }),
					readUser: async () => ({ mcpServers: {} }),
					desiredFromConfig: (c: unknown) => {
						const o = c as {
							mcp: Record<string, { transport: string; url?: string; command?: string; args?: string[] }>;
						};
						const out: Record<string, { type: "http" | "stdio"; url?: string; command?: string; args?: string[] }> = {};
						for (const [k, v] of Object.entries(o.mcp))
							out[k] =
								v.transport === "http"
									? { type: "http", url: v.url }
									: { type: "stdio", command: String(v.command), args: v.args };
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

			const payload = {
				server: {
					name: "com.example/my-server",
					packages: [
						{ registryType: "npm", transport: { type: "stdio" }, identifier: "@modelcontextprotocol/server-memory" },
					],
				},
			} as const;
			const fetchMock = vi.fn(
				async () =>
					new Response(JSON.stringify(payload), { status: 200, headers: { "content-type": "application/json" } }),
			);
			global.fetch = fetchMock;

			const { registerMcpCommand } = await import("../src/commands/mcp/index.ts");
			const program = new Command();
			registerMcpCommand(program);
			const cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(dir);
			await program.parseAsync(["node", "cli", "mcp", "add", "com.example/my-server@1.2.3"], { from: "node" });
			cwdSpy.mockRestore();

			const cfg = JSON.parse(await readFile(join(dir, "katacut.config.jsonc"), "utf8")) as {
				mcp: Record<string, unknown>;
			};
			expect(Object.keys(cfg.mcp)).toContain("my-server");
			const txt = await readFile(join(dir, "katacut.config.jsonc"), "utf8");
			expect(txt.includes("@modelcontextprotocol/server-memory")).toBe(true);
			const stLock = await stat(join(dir, "katacut.lock.json"));
			expect(stLock.isFile()).toBe(true);
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});
});
