import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

describe("ClaudeCode user config discovery (XDG & errors)", () => {
	it("uses XDG settings.json when home candidates absent", async () => {
		const fakeHome = await mkdtemp(join(tmpdir(), "kc-cc-home-xdg-"));
		const xdg = await mkdtemp(join(tmpdir(), "kc-cc-xdg-"));
		try {
			await mkdir(join(xdg, "claude"), { recursive: true });
			const content = { mcpServers: { x: { type: "stdio", command: "echo", args: ["hi"] } } };
			await writeFile(join(xdg, "claude", "settings.json"), JSON.stringify(content), "utf8");

			vi.resetModules();
			vi.stubEnv("XDG_CONFIG_HOME", xdg);
			vi.doMock("node:os", async () => ({ homedir: () => fakeHome, tmpdir: () => tmpdir() }));
			const mod = await import("@katacut/adapter-client-claude-code");
			const res = await mod.readUserMcp();
			expect(res.source?.startsWith(join(xdg, "claude"))).toBe(true);
			expect(res.mcpServers.x).toEqual({ type: "stdio", command: "echo", args: ["hi"] });
		} finally {
			vi.unstubAllEnvs();
			vi.doUnmock("node:os");
			await rm(fakeHome, { recursive: true, force: true });
			await rm(xdg, { recursive: true, force: true });
		}
	});

	it("ignores broken JSON and returns empty when no valid candidates", async () => {
		const fakeHome = await mkdtemp(join(tmpdir(), "kc-cc-home-bad-"));
		try {
			await mkdir(join(fakeHome, ".claude"), { recursive: true });
			await writeFile(join(fakeHome, ".claude", "settings.json"), "{not-json}", "utf8");

			vi.resetModules();
			vi.doMock("node:os", async () => ({ homedir: () => fakeHome, tmpdir: () => tmpdir() }));
			const mod = await import("@katacut/adapter-client-claude-code");
			const res = await mod.readUserMcp();
			expect(res.source).toBeUndefined();
			expect(Object.keys(res.mcpServers).length).toBe(0);
		} finally {
			vi.doUnmock("node:os");
			await rm(fakeHome, { recursive: true, force: true });
		}
	});
});
