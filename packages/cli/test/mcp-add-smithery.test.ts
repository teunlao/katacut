import { describe, it, expect, vi } from "vitest";
import { Command } from "commander";
import { mkdtemp, rm, writeFile, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("kc mcp add <smithery server url>", () => {
  it("normalizes server.smithery.ai/.../mcp to HTTP server", async () => {
    const dir = await mkdtemp(join(tmpdir(), "kc-add-smithery-"));
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
            const o = c as { mcp: Record<string, { transport: string; url?: string; command?: string; args?: string[]; env?: Record<string,string> }> };
            const out: Record<string, { type: "http"|"stdio"; url?: string; command?: string; args?: string[]; env?: Record<string,string> }> = {};
            for (const [k,v] of Object.entries(o.mcp)) out[k] = v.transport === "http" ? { type: "http", url: String(v.url ?? "") } : { type: "stdio", command: String(v.command ?? ""), args: v.args, env: v.env };
            return out;
          },
          applyInstall: async (plan: readonly { action: "add"|"update"|"remove"; name: string }[]) => {
            const added = plan.filter(p => p.action === "add").length;
            return { added, updated: 0, removed: 0, failed: 0 };
          },
        } as const;
        return { getAdapter: async () => adapter };
      });

      const { registerMcpCommand } = await import("../src/commands/mcp/index.ts");
      const program = new Command();
      registerMcpCommand(program);
      const cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(dir);
      await program.parseAsync(["node","cli","mcp","add","https://server.smithery.ai/@org/example/mcp"], { from: "node" });
      cwdSpy.mockRestore();

      const cfg = JSON.parse(await readFile(join(dir, "katacut.config.jsonc"), "utf8")) as { mcp: Record<string, any> };
      expect(cfg.mcp["example"]).toBeTruthy();
      expect(cfg.mcp["example"].transport).toBe("http");
      expect(cfg.mcp["example"].url).toBe("https://server.smithery.ai/@org/example/mcp");
      const stLock = await stat(join(dir, "katacut.lock.json"));
      expect(stLock.isFile()).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

