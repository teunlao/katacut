import { describe, it, expect } from "vitest";
import { diffByNames } from "@katacut/core";
import { claudeCodeAdapter } from "../../adapters/client-claude-code/src/public-adapter.js";

describe("plan diff (core)", () => {
  const config = {
    version: "0.1.0",
    mcp: {
      github: { transport: "http", url: "https://api.githubcopilot.com/mcp", headers: {} },
      fs: { transport: "stdio", command: "npx", args: ["-y", "@modelcontextprotocol/server-filesystem", "."], env: {} },
    },
  } as const;

  it("diffs by names with prune", () => {
    const desired = claudeCodeAdapter.desiredFromConfig(config as unknown);
    const names = new Set(["github", "extra"]);
    const plan = diffByNames(desired, names, true);
    expect(plan.find((a) => a.action === "add" && a.name === "fs")).toBeTruthy();
    expect(plan.find((a) => a.action === "update" && a.name === "github")).toBeTruthy();
    expect(plan.find((a) => a.action === "remove" && a.name === "extra")).toBeTruthy();
  });
});
