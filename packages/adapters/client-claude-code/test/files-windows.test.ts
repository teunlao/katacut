import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

describe("ClaudeCode user config discovery (Windows-like)", () => {
	it("reads from %APPDATA%/Claude/settings.json when present", async () => {
		const fakeHome = await mkdtemp(join(tmpdir(), "kc-cc-home-win-"));
		const appdata = await mkdtemp(join(tmpdir(), "kc-cc-appdata-"));
		try {
			await mkdir(join(appdata, "Claude"), { recursive: true });
			const content = { mcpServers: { win: { type: "http", url: "https://x" } } };
			await writeFile(join(appdata, "Claude", "settings.json"), JSON.stringify(content), "utf8");

			vi.resetModules();
			vi.stubEnv("APPDATA", appdata);
			vi.stubEnv("USERPROFILE", fakeHome);
			vi.doMock("node:os", async () => ({ homedir: () => fakeHome, tmpdir: () => tmpdir() }));
			const mod = await import("@katacut/adapter-client-claude-code");
			const res = await mod.readUserMcp();
			expect(res.source?.endsWith("Claude/settings.json")).toBe(true);
			expect(res.mcpServers.win).toEqual({ type: "http", url: "https://x" });
		} finally {
			vi.unstubAllEnvs();
			vi.doUnmock("node:os");
			await rm(fakeHome, { recursive: true, force: true });
			await rm(appdata, { recursive: true, force: true });
		}
	});

	it("falls back to %USERPROFILE%/.claude.json when present", async () => {
		const fakeHome = await mkdtemp(join(tmpdir(), "kc-cc-home-win2-"));
		try {
			const content = { mcpServers: { up: { type: "stdio", command: "echo" } } };
			await writeFile(join(fakeHome, ".claude.json"), JSON.stringify(content), "utf8");

			vi.resetModules();
			vi.stubEnv("USERPROFILE", fakeHome);
			vi.doMock("node:os", async () => ({ homedir: () => fakeHome, tmpdir: () => tmpdir() }));
			const mod = await import("@katacut/adapter-client-claude-code");
			const res = await mod.readUserMcp();
			expect(res.source?.endsWith(".claude.json")).toBe(true);
			expect(res.mcpServers.up).toEqual({ type: "stdio", command: "echo" });
		} finally {
			vi.unstubAllEnvs();
			vi.doUnmock("node:os");
			await rm(fakeHome, { recursive: true, force: true });
		}
	});
});
