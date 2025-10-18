import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Command } from "commander";
import { describe, expect, it, vi } from "vitest";

describe("format flags --json/--no-summary", () => {
	it("doctor --json prints only JSON (no summary)", async () => {
		vi.resetModules();
		const { registerDoctorCommand } = await import("../src/commands/doctor.ts");
		const program = new Command();
		registerDoctorCommand(program);
		const logs: string[] = [];
		vi.spyOn(console, "log").mockImplementation((s: unknown) => {
			if (typeof s === "string") logs.push(s);
		});
		await program.parseAsync(["node", "cli", "doctor", "--json"], { from: "node" });
		const out = logs.join("\n");
		expect(out.trim().startsWith("{")).toBe(true);
		expect(out.includes("Doctor Summary:")).toBe(false);
	});

	it("install --json prints only JSON plan (no labels/tables)", async () => {
		const dir = await mkdtemp(join(tmpdir(), "kc-format-"));
		try {
			await writeFile(join(dir, "katacut.config.jsonc"), JSON.stringify({ version: "0.1.0", mcp: {} }), "utf8");
			vi.resetModules();
			vi.doMock("../src/lib/adapters/registry.ts", () => {
				const adapter = {
					id: "claude-code",
					checkAvailable: async () => true,
					readProject: async () => ({ mcpServers: {} }),
					readUser: async () => ({ mcpServers: {} }),
					desiredFromConfig: () => ({}),
					applyInstall: async () => ({ added: 0, updated: 0, removed: 0, failed: 0 }),
				} as const;
				return { getAdapter: async () => adapter };
			});
			const { registerInstallCommand } = await import("../src/commands/install.ts");
			const program = new Command();
			registerInstallCommand(program);
			const logs: string[] = [];
			vi.spyOn(console, "log").mockImplementation((s: unknown) => {
				if (typeof s === "string") logs.push(s);
			});
			const cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(dir);
			await program.parseAsync(["node", "cli", "install", "--json", "--dry-run"], { from: "node" });
			cwdSpy.mockRestore();
			const out = logs.join("\n");
			expect(out.includes("Plan:")).toBe(false);
			expect(out.includes("Name  |  Action")).toBe(false);
			// must include a JSON array (plan)
			expect(out.trim().startsWith("[")).toBe(true);
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});
});
