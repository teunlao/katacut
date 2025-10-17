import { describe, it, expect } from "vitest";
import { diffByNames } from "../src/lib/plan.js";
import { getAdapter } from "../src/lib/adapters/registry.js";

describe("generic plan helpers", () => {
  const config = {
    version: "0.1.0",
    mcp: {
      github: { transport: "http", url: "https://api.githubcopilot.com/mcp", headers: {} },
      fs: { transport: "stdio", command: "npx", args: ["-y", "@modelcontextprotocol/server-filesystem", "."], env: {} },
    },
  } as const;

  it("produces desired from config via adapter", async () => {
    const adapter = await getAdapter("ClaudeCode");
    const d = adapter.desiredFromConfig(config as any);
    expect(Object.keys(d).sort()).toEqual(["fs", "github"]);
    expect(d.github.type).toBe("http");
    expect(d.fs.type).toBe("stdio");
  });

  it("diffs by names with prune", async () => {
    const adapter = await getAdapter("ClaudeCode");
    const desired = adapter.desiredFromConfig(config as any);
    const names = new Set(["github", "extra"]);
    const plan = diffByNames(desired, names, true);
    expect(plan.find((a) => a.action === "add" && a.name === "fs")).toBeTruthy();
    expect(plan.find((a) => a.action === "update" && a.name === "github")).toBeTruthy();
    expect(plan.find((a) => a.action === "remove" && a.name === "extra")).toBeTruthy();
  });
});
