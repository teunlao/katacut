import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Command } from "commander";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("kc install --lockfile-only --frozen-lockfile with mismatch", () => {
  const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  beforeEach(() => errSpy.mockClear());
  afterEach(() => {
    errSpy.mockClear();
    // reset exit code for other tests
    // eslint-disable-next-line unicorn/no-null
    (process as unknown as { exitCode?: number | null }).exitCode = 0;
  });

  it("exits with code 1 and does not rewrite lockfile", async () => {
    const dir = await mkdtemp(join(tmpdir(), "kc-frozen-mismatch-"));
    try {
      // Config desires 'b', but lock contains 'a' only
      await writeFile(
        join(dir, "katacut.config.jsonc"),
        JSON.stringify({ version: "0.1.0", mcp: { b: { transport: "http", url: "https://b" } } }),
        "utf8",
      );
      await writeFile(join(dir, ".mcp.json"), JSON.stringify({ mcpServers: {} }), "utf8");
      const lock = {
        version: "1",
        client: "claude-code",
        mcpServers: {
          a: { scope: "project", fingerprint: "fp-a", snapshot: { type: "http", url: "https://a" } },
        },
      };
      const lockPath = join(dir, "katacut.lock.json");
      const before = JSON.stringify(lock);
      await writeFile(lockPath, before, "utf8");

      vi.resetModules();
      vi.doMock("../src/lib/adapters/registry.ts", () => {
        const adapter = {
          id: "claude-code",
          checkAvailable: async () => true,
          readProject: async () => ({ mcpServers: {} }),
          readUser: async () => ({ mcpServers: {} }),
          desiredFromConfig: () => ({ b: { type: "http", url: "https://b" } }),
          applyInstall: async () => ({ added: 0, updated: 0, removed: 0, failed: 0 } as const),
        } as const;
        return { getAdapter: async () => adapter };
      });

      const { registerInstallCommand } = await import("../src/commands/install.ts");
      const program = new Command();
      registerInstallCommand(program);
      const cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(dir);

      await program.parseAsync(
        [
          "node",
          "cli",
          "install",
          "--client",
          "claude-code",
          "--scope",
          "project",
          "--lockfile-only",
          "--frozen-lockfile",
          "-c",
          "katacut.config.jsonc",
        ],
        { from: "node" },
      );

      expect(process.exitCode).toBe(1);
      const after = await readFile(lockPath, "utf8");
      expect(after).toBe(before);
      cwdSpy.mockRestore();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

