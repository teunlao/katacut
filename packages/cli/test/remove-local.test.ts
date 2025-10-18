import { describe, it, expect, vi } from "vitest";
import { Command } from "commander";
import { mkdtemp, rm, writeFile, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("kc mcp remove --local", () => {
  it("removes only at client, keeps config/lock intact, writes local state", async () => {
    const dir = await mkdtemp(join(tmpdir(), "kc-remove-local-"));
    try {
      // Config with two servers
      const cfg = { version: "0.1.0", mcp: { keep: { transport: "http", url: "https://k" }, del: { transport: "http", url: "https://d" } } } as const;
      await writeFile(join(dir, "katacut.config.jsonc"), JSON.stringify(cfg), "utf8");
      // Current state has both
      await writeFile(join(dir, ".mcp.json"), JSON.stringify({ mcpServers: { keep: { type: "http", url: "https://k" }, del: { type: "http", url: "https://d" } } }), "utf8");

      vi.resetModules();
      vi.doMock("../../src/lib/adapters/registry.ts", () => {
        const adapter = {
          id: "claude-code",
          checkAvailable: async () => true,
          readProject: async () => ({ mcpServers: { keep: { type: "http", url: "https://k" }, del: { type: "http", url: "https://d" } } }),
          readUser: async () => ({ mcpServers: {} }),
          desiredFromConfig: (c: unknown) => {
            const o = c as { mcp: Record<string, { transport: string; url?: string; command?: string }> };
            const out: Record<string, { type: "http"|"stdio"; url?: string; command?: string }> = {};
            for (const [k,v] of Object.entries(o.mcp)) out[k] = v.transport === "http" ? { type: "http", url: v.url } : { type: "stdio", command: v.command };
            return out as any;
          },
          applyInstall: async (plan: readonly any[], scope: "project"|"user") => {
            // Count removes only
            const removed = plan.filter(p => p.action === "remove").length;
            return { added: 0, updated: 0, removed, failed: 0 };
          },
        } as const;
        return { getAdapter: async () => adapter };
      });

      const { registerMcpCommand } = await import("../src/commands/mcp/index.ts");
      const program = new Command();
      registerMcpCommand(program);
      const cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(dir);
      await program.parseAsync(["node","cli","mcp","remove","del","--client","claude-code","--scope","project","--local","-y"], { from: "node" });
      cwdSpy.mockRestore();

      // Config intact
      const cfgText = await readFile(join(dir, "katacut.config.jsonc"), "utf8");
      expect(cfgText.includes("\"del\"")) .toBe(true);
      // Lock didn't appear
      await expect(stat(join(dir, "katacut.lock.json"))).rejects.toBeTruthy();
      // State present with intent=local
      const stateText = await readFile(join(dir, ".katacut", "state.json"), "utf8");
      const state = JSON.parse(stateText);
      expect(state.runs[0].intent).toBe("local");
      expect(state.runs[0].entries.del.outcome).toBe("remove");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
