import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Command } from "commander";
import { describe, expect, it, vi } from "vitest";

describe("kc doctor", () => {
	it("reports ok when CLI available, paths writable and no conflicts", async () => {
		vi.resetModules();
		const dir = await mkdtemp(join(tmpdir(), "kc-doctor-ok-"));
		try {
			await mkdir(dir, { recursive: true });
			await writeFile(
				join(dir, ".mcp.json"),
				JSON.stringify({ mcpServers: { a: { type: "http", url: "https://a" } } }),
				"utf8",
			);

			vi.doMock("../src/lib/adapters/registry.ts", () => {
				const adapter = {
					id: "claude-code",
					checkAvailable: async () => true,
					readProject: async () => ({ mcpServers: { a: { type: "http", url: "https://a" } } }),
					readUser: async () => ({
						source: join(dir, "user.json"),
						mcpServers: { b: { type: "stdio", command: "echo" } },
					}),
				} as const;
				return { getAdapter: async () => adapter };
			});
			await writeFile(
				join(dir, "user.json"),
				JSON.stringify({ mcpServers: { b: { type: "stdio", command: "echo" } } }),
				"utf8",
			);

			const { registerDoctorCommand } = await import("../src/commands/doctor.ts");
			const program = new Command();
			registerDoctorCommand(program);
			const logs: string[] = [];
			const spy = vi.spyOn(console, "log").mockImplementation((s: unknown) => {
				if (typeof s === "string") logs.push(s);
			});
			const cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(dir);
			await program.parseAsync(["node", "cli", "doctor", "--client", "claude-code"], { from: "node" });
			cwdSpy.mockRestore();
			spy.mockRestore();
			const payload = JSON.parse(logs[0] ?? "{}");
			expect(payload.status).toBe("ok");
			expect(payload.client).toBe("claude-code");
			expect(payload.conflicts).toEqual([]);
			expect(payload.project.readable).toBeTypeOf("boolean");
			expect(payload.project.writable).toBeTypeOf("boolean");
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});

	it("reports warn on conflicts and error when CLI is missing", async () => {
		vi.resetModules();
		const dir = await mkdtemp(join(tmpdir(), "kc-doctor-warn-"));
		try {
			await writeFile(
				join(dir, ".mcp.json"),
				JSON.stringify({ mcpServers: { c: { type: "http", url: "https://proj" } } }),
				"utf8",
			);
			const userPath = join(dir, "user.json");
			await writeFile(userPath, JSON.stringify({ mcpServers: { c: { type: "http", url: "https://user" } } }), "utf8");
			await chmod(userPath, 0o444); // read-only

			vi.doMock("../src/lib/adapters/registry.ts", () => {
				const adapter = {
					id: "claude-code",
					checkAvailable: async () => false,
					readProject: async () => ({ mcpServers: { c: { type: "http", url: "https://proj" } } }),
					readUser: async () => ({ source: userPath, mcpServers: { c: { type: "http", url: "https://user" } } }),
				} as const;
				return { getAdapter: async () => adapter };
			});

			const { registerDoctorCommand } = await import("../src/commands/doctor.ts");
			const program = new Command();
			registerDoctorCommand(program);
			const logs: string[] = [];
			const spy = vi.spyOn(console, "log").mockImplementation((s: unknown) => {
				if (typeof s === "string") logs.push(s);
			});
			const cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(dir);
			await program.parseAsync(["node", "cli", "doctor"], { from: "node" });
			cwdSpy.mockRestore();
			spy.mockRestore();
			const payload = JSON.parse(logs[0] ?? "{}");
			expect(payload.cli.available).toBe(false);
			expect(payload.status).toBe("error");
			expect(Array.isArray(payload.conflicts)).toBe(true);
			expect(payload.conflicts.length).toBe(1);
			expect(payload.cli.available).toBe(false);
			expect(payload.user.writable).toBe(false);
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});
});
