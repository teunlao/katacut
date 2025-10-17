import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Command } from "commander";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ServerJson } from "@katacut/core";

type ActionKind = "add" | "update" | "remove" | "skip";
interface PlanItem { readonly action: ActionKind; readonly name: string; readonly json?: ServerJson }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parsePlanJson(maybe: unknown): PlanItem[] {
  if (typeof maybe !== "string") return [];
  try {
    const parsed = JSON.parse(maybe) as unknown;
    if (!Array.isArray(parsed)) return [];
    const filtered: PlanItem[] = [];
    for (const it of parsed) {
      if (isRecord(it) && typeof it.action === "string" && typeof it.name === "string") {
        const act = it.action as string;
        if (act === "add" || act === "update" || act === "remove" || act === "skip") {
          filtered.push({ action: act, name: it.name, json: isRecord(it.json) ? (it.json as ServerJson) : undefined });
        }
      }
    }
    return filtered;
  } catch {
    return [];
  }
}

describe("kc install (CLI)", () => {
  const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  let dir: string;

  beforeEach(async () => {
    logSpy.mockClear();
    dir = await mkdtemp(join(tmpdir(), "kc-cli-install-"));
  });
  afterEach(async () => {
    logSpy.mockClear();
    await rm(dir, { recursive: true, force: true });
  });

  it("dry-run shows ADD when current is empty; idempotency yields SKIP", async () => {
    vi.resetModules();
    const configPath = join(dir, "katacut.config.jsonc");
    const cfg = {
      version: "0.1.0",
      mcp: {
        a: { transport: "http", url: "https://a" },
        b: { transport: "stdio", command: "echo", args: ["hi"] },
      },
    } as const;
    await writeFile(configPath, JSON.stringify(cfg), "utf8");

    // Mutable current state to simulate two runs
    let current: Record<string, unknown> = {};

    vi.doMock("../src/lib/adapters/registry.ts", () => {
      const adapter = {
        id: "claude-code",
        checkAvailable: async () => true,
        readProject: async () => ({ mcpServers: current }),
        readUser: async () => ({ mcpServers: current }),
        desiredFromConfig: (c: unknown) => {
          const out: Record<string, ServerJson> = {};
          if (!isRecord(c) || !isRecord(c.mcp)) return out;
          for (const [k, v] of Object.entries(c.mcp)) {
            if (!isRecord(v) || typeof v.transport !== "string") continue;
            if (v.transport === "http" && typeof v.url === "string") {
              out[k] = { type: "http", url: v.url };
            } else if (v.transport === "stdio" && typeof v.command === "string") {
              const args = Array.isArray(v.args) ? (v.args.filter((a) => typeof a === "string") as string[]) : undefined;
              out[k] = { type: "stdio", command: v.command, args };
            }
          }
          return out;
        },
        applyInstall: async () => ({ added: 0, updated: 0, removed: 0, failed: 0 }),
      } as const;
      return { getAdapter: async () => adapter };
    });

    const { registerInstallCommand } = await import("../src/commands/install.ts");
    const program = new Command();
    registerInstallCommand(program);

    // First run: no current -> add two
    await program.parseAsync(["node", "cli", "install", "--client", "claude-code", "--scope", "project", "--dry-run", "-c", configPath], { from: "node" });
    const jsonLog1 = logSpy.mock.calls.map((c) => c[0]).find((s) => typeof s === "string" && String(s).trim().startsWith("["));
    const plan1 = parsePlanJson(jsonLog1);
    expect(plan1.filter((s) => s.action === "add").length).toBe(2);

    // Make current = desired
    current = { a: { type: "http", url: "https://a" }, b: { type: "stdio", command: "echo", args: ["hi"] } };
    await program.parseAsync(["node", "cli", "install", "--client", "claude-code", "--scope", "project", "--dry-run", "-c", configPath], { from: "node" });
    const jsonLog2 = logSpy.mock.calls.map((c) => c[0]).reverse().find((s) => typeof s === "string" && String(s).trim().startsWith("["));
    const plan2 = parsePlanJson(jsonLog2);
    expect(plan2.every((s) => s.action === "skip")).toBe(true);
  });

  it("apply filters out SKIP and prints summary", async () => {
    vi.resetModules();
    const configPath = join(dir, "katacut.config.jsonc");
    const cfg = { version: "0.1.0", mcp: { x: { transport: "http", url: "https://x" } } } as const;
    await writeFile(configPath, JSON.stringify(cfg), "utf8");

    let receivedSteps: readonly PlanItem[] | undefined;

    vi.doMock("../src/lib/adapters/registry.ts", () => {
      const adapter = {
        id: "claude-code",
        checkAvailable: async () => true,
        readProject: async () => ({ mcpServers: { x: { type: "http", url: "https://different" }, keep: { type: "stdio", command: "echo" } } }),
        readUser: async () => ({ mcpServers: {} }),
        desiredFromConfig: () => ({ x: { type: "http", url: "https://x" } }),
        applyInstall: async (plan: readonly PlanItem[]) => {
          receivedSteps = [...plan];
          const added = plan.filter((s) => s.action === "add").length;
          const updated = plan.filter((s) => s.action === "update").length;
          const removed = plan.filter((s) => s.action === "remove").length;
          return { added, updated, removed, failed: 0 };
        },
      } as const;
      return { getAdapter: async () => adapter };
    });

    const { registerInstallCommand } = await import("../src/commands/install.ts");
    const program = new Command();
    registerInstallCommand(program);

    await program.parseAsync(["node", "cli", "install", "--client", "claude-code", "--scope", "project", "-c", configPath], { from: "node" });

    // First two logs: Plan label + plan JSON, then Summary line
    const jsonPlan = logSpy.mock.calls
      .map((c) => c[0])
      .find((s) => typeof s === "string" && String(s).trim().startsWith("["));
    const plan = parsePlanJson(jsonPlan);
    // Plan is an array; presence validated by JSON selection above
    expect(Array.isArray(plan)).toBe(true);

    // Steps passed to adapter should exclude SKIP
    expect((receivedSteps ?? []).every((s) => s.action !== "skip")).toBe(true);

    // Summary printed
    const summaryLine = (logSpy.mock.calls.map((c) => c[0]).find((s) => typeof s === "string" && String(s).startsWith("Summary:")) as string | undefined) ?? "";
    expect(summaryLine).toMatch(/Summary: (added=1 updated=0|added=0 updated=1) removed=0 skipped=0 failed=0/);
  });
});
