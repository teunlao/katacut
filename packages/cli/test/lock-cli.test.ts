import { describe, it, expect, vi } from "vitest";
import { Command } from "commander";
import { mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("kc lock", () => {
  it("generates lock from config and verifies against project", async () => {
    const dir = await mkdtemp(join(tmpdir(), "kc-lock-"));
    try {
      const config = {
        version: "0.1.0",
        mcp: { x: { transport: "http", url: "https://x" } },
      } as const;
      await writeFile(join(dir, "katacut.config.jsonc"), JSON.stringify(config), "utf8");
      await writeFile(join(dir, ".mcp.json"), JSON.stringify({ mcpServers: { x: { type: "http", url: "https://x" } } }), "utf8");

      vi.doMock("../src/lib/adapters/registry.ts", () => {
        const adapter = {
          id: "claude-code",
          checkAvailable: async () => true,
          readProject: async () => ({ mcpServers: { x: { type: "http", url: "https://x" } } }),
          readUser: async () => ({ mcpServers: {} }),
          desiredFromConfig: () => ({ x: { type: "http", url: "https://x" } }),
        } as const;
        return { getAdapter: async () => adapter };
      });

      const { registerLockCommand } = await import("../src/commands/lock.ts");
      const program = new Command();
      registerLockCommand(program);

      const logs: string[] = [];
      vi.spyOn(console, "log").mockImplementation((s: unknown) => { if (typeof s === "string") logs.push(s); });

      // generate to file
      const cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(dir);
      await program.parseAsync(["node", "cli", "lock", "generate", "--client", "claude-code", "--scope", "project", "-c", "katacut.config.jsonc", "--out", "katacut.lock.json"], { from: "node" });
      const lockText = await readFile(join(dir, "katacut.lock.json"), "utf8");
      const lock = JSON.parse(lockText) as { mcpServers: Record<string, { fingerprint: string; scope: string }> };
      expect(lock.mcpServers.x.scope).toBe("project");
      expect(typeof lock.mcpServers.x.fingerprint).toBe("string");

      // verify ok
      logs.length = 0;
      await program.parseAsync(["node", "cli", "lock", "verify", "--client", "claude-code"], { from: "node" });
      cwdSpy.mockRestore();
      const report = JSON.parse(logs[0] ?? "{}");
      expect(report.status).toBe("ok");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

