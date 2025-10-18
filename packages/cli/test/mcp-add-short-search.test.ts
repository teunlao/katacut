import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Command } from "commander";
import { describe, expect, it, vi } from "vitest";

describe("kc mcp add <short>[@version] via registry search", () => {
  it("resolves unique short name and applies", async () => {
    const dir = await mkdtemp(join(tmpdir(), "kc-add-short-"));
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
            const o = c as { mcp: Record<string, { transport: string; url?: string }> };
            const out: Record<string, { type: "http"; url: string }> = {} as never;
            for (const [k, v] of Object.entries(o.mcp)) out[k] = { type: "http", url: String((v as any).url ?? "") } as any;
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

      // Mock fetch: search + version
      const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/servers?search=filesystem")) {
          const payload = { servers: [{ server: { name: "com.example/filesystem" } }], metadata: { count: 1 } } as const;
          return new Response(JSON.stringify(payload), { status: 200, headers: { "content-type": "application/json" } });
        }
        if (url.includes("/servers/com.example%2Ffilesystem/versions/latest")) {
          const payload = { server: { name: "com.example/filesystem", remotes: [{ type: "http", url: "https://api.example.com/mcp" }] } } as const;
          return new Response(JSON.stringify(payload), { status: 200, headers: { "content-type": "application/json" } });
        }
        return new Response("not found", { status: 404 });
      });
      // @ts-expect-error assign for test
      global.fetch = fetchMock;

      const { registerMcpCommand } = await import("../src/commands/mcp/index.ts");
      const program = new Command();
      registerMcpCommand(program);
      const cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(dir);
      await program.parseAsync(["node", "cli", "mcp", "add", "filesystem"], { from: "node" });
      cwdSpy.mockRestore();

      const cfg = JSON.parse(await readFile(join(dir, "katacut.config.jsonc"), "utf8")) as { mcp: Record<string, unknown> };
      expect(Object.keys(cfg.mcp)).toContain("filesystem");
      const stLock = await stat(join(dir, "katacut.lock.json"));
      expect(stLock.isFile()).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("errors on ambiguous short name", async () => {
    const dir = await mkdtemp(join(tmpdir(), "kc-add-short-amb-"));
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
          desiredFromConfig: () => ({}),
          applyInstall: async () => ({ added: 0, updated: 0, removed: 0, failed: 0 }),
        } as const;
        return { getAdapter: async () => adapter };
      });

      const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/servers?search=memory")) {
          const payload = {
            servers: [
              { server: { name: "com.letta/memory-mcp" } },
              { server: { name: "io.github.NeerajG03/vector-memory" } },
            ],
            metadata: { count: 2 },
          } as const;
          return new Response(JSON.stringify(payload), { status: 200, headers: { "content-type": "application/json" } });
        }
        return new Response("not found", { status: 404 });
      });
      // @ts-expect-error test assignment
      global.fetch = fetchMock;

      const { registerMcpCommand } = await import("../src/commands/mcp/index.ts");
      const program = new Command();
      registerMcpCommand(program);
      const cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(dir);
      await program.parseAsync(["node", "cli", "mcp", "add", "memory"], { from: "node" });
      cwdSpy.mockRestore();

      // Should not create lockfile due to ambiguity
      await expect(stat(join(dir, "katacut.lock.json"))).rejects.toBeTruthy();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

