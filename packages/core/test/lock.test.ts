import { describe, it, expect } from "vitest";
import { buildLock, computeFingerprint, verifyLock } from "@katacut/core";

describe("lockfile core", () => {
  it("computes stable fingerprint and verifies against current", () => {
    const desired = {
      a: { type: "http", url: "https://a" },
      b: { type: "stdio", command: "echo", args: ["x"] },
    } as const;
    const fpA = computeFingerprint(desired.a);
    const fpA2 = computeFingerprint({ type: "http", url: "https://a" });
    expect(fpA).toBe(fpA2);

    const lock = buildLock("claude-code", desired, "project");
    const report = verifyLock(lock, { source: undefined, mcpServers: { ...desired } }, { mcpServers: {} });
    expect(report.status).toBe("ok");
  });

  it("reports mismatch for missing and changed servers", () => {
    const desired = { x: { type: "http", url: "https://x" } } as const;
    const lock = buildLock("claude-code", desired, "project");
    const report = verifyLock(lock, { source: undefined, mcpServers: {} }, { mcpServers: {} });
    expect(report.status).toBe("mismatch");
    expect(report.mismatches[0]?.reason).toBe("missing");
  });
});

