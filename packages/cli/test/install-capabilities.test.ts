import { describe, it, expect, vi } from "vitest";
import { Command } from "commander";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("kc install with adapter capabilities", () => {
  it("fallbacks to user when project unsupported but emulation allowed", async () => {
    const dir = await mkdtemp(join(tmpdir(), "kc-cap-emu-"));
    try {
      await writeFile(join(dir, "katacut.config.jsonc"), JSON.stringify({ version: "0.1.0", mcp: { a: { transport: "http", url: "https://a" } } }), "utf8");
      // project empty, user has different to ensure branch coverage
      await writeFile(join(dir, ".mcp.json"), JSON.stringify({ mcpServers: {} }), "utf8");

      vi.resetModules();
      vi.doMock("../src/lib/adapters/registry.ts", () => {
        const adapter = {
          id: "fake-client",
          checkAvailable: async () => true,
          capabilities: () => ({ supportsProject: false, supportsUser: true, emulateProjectWithUser: true, supportsGlobalExplicit: false }),
          readProject: async () => ({ mcpServers: {} }),
          readUser: async () => ({ mcpServers: {} }),
          desiredFromConfig: () => ({ a: { type: "http", url: "https://a" } }),
          applyInstall: async () => ({ added: 1, updated: 0, removed: 0, failed: 0 }),
        } as const;
        return { getAdapter: async () => adapter };
      });

      const { registerInstallCommand } = await import("../src/commands/install.ts");
      const program = new Command();
      registerInstallCommand(program);
      const logs: string[] = [];
      vi.spyOn(console, "log").mockImplementation((s: unknown) => { if (typeof s === "string") logs.push(s); });
      const cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(dir);
      await program.parseAsync(["node", "cli", "install", "--client", "fake-client", "--scope", "project", "-c", "katacut.config.jsonc"], { from: "node" });
      cwdSpy.mockRestore();
      expect(logs.find((l) => l.includes("emulated project"))).toBeTruthy();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("throws when project unsupported and emulation disabled", async () => {
    const dir = await mkdtemp(join(tmpdir(), "kc-cap-noemu-"));
    try {
      await writeFile(join(dir, "katacut.config.jsonc"), JSON.stringify({ version: "0.1.0", mcp: { a: { transport: "http", url: "https://a" } } }), "utf8");
      await writeFile(join(dir, ".mcp.json"), JSON.stringify({ mcpServers: {} }), "utf8");

      vi.resetModules();
      vi.doMock("../src/lib/adapters/registry.ts", () => {
        const adapter = {
          id: "fake-client",
          checkAvailable: async () => true,
          capabilities: () => ({ supportsProject: false, supportsUser: true, emulateProjectWithUser: false, supportsGlobalExplicit: false }),
          readProject: async () => ({ mcpServers: {} }),
          readUser: async () => ({ mcpServers: {} }),
          desiredFromConfig: () => ({ a: { type: "http", url: "https://a" } }),
          applyInstall: async () => ({ added: 0, updated: 0, removed: 0, failed: 0 }),
        } as const;
        return { getAdapter: async () => adapter };
      });

      const { registerInstallCommand } = await import("../src/commands/install.ts");
      const program = new Command();
      registerInstallCommand(program);
      const cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(dir);
      await expect(program.parseAsync(["node", "cli", "install", "--client", "fake-client", "--scope", "project", "-c", "katacut.config.jsonc"], { from: "node" })).rejects.toBeTruthy();
      cwdSpy.mockRestore();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

