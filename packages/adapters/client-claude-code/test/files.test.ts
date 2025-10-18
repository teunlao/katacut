import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

describe("ClaudeCode file readers", () => {
	it("reads project .mcp.json", async () => {
		const dir = await mkdtemp(join(tmpdir(), "kc-cc-proj-"));
		try {
			const content = {
				mcpServers: {
					github: { type: "http", url: "https://api.githubcopilot.com/mcp", headers: {} },
					fs: { type: "stdio", command: "npx", args: ["-y", "@modelcontextprotocol/server-filesystem", "."], env: {} },
				},
			};
			await writeFile(join(dir, ".mcp.json"), JSON.stringify(content), "utf8");

			const mod = await import("@katacut/adapter-client-claude-code");
			const res = await mod.readProjectMcp(dir);
			expect(res.source).toBe(join(dir, ".mcp.json"));
			expect(Object.keys(res.mcpServers).sort()).toEqual(["fs", "github"]);
			expect(res.mcpServers.github).toEqual({ type: "http", url: "https://api.githubcopilot.com/mcp", headers: {} });
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});

	it("reads user settings mcpServers (top-level)", async () => {
		const fakeHome = await mkdtemp(join(tmpdir(), "kc-cc-home-"));
		try {
			await mkdir(join(fakeHome, ".claude"), { recursive: true });
			const content = { mcpServers: { x: { type: "stdio", command: "echo", args: ["hi"] } } };
			await writeFile(join(fakeHome, ".claude", "settings.json"), JSON.stringify(content), "utf8");

			vi.resetModules();
			vi.doMock("node:os", async () => ({
				homedir: () => fakeHome,
				tmpdir: () => tmpdir(),
			}));
			const mod = await import("@katacut/adapter-client-claude-code");
			const res = await mod.readUserMcp();
			expect(res.source?.endsWith(".claude/settings.json")).toBe(true);
			expect(res.mcpServers.x).toEqual({ type: "stdio", command: "echo", args: ["hi"] });
		} finally {
			vi.doUnmock("node:os");
			await rm(fakeHome, { recursive: true, force: true });
		}
	});
});
