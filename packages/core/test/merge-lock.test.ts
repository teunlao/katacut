import { describe, expect, it } from "vitest";
import { mergeLock, type Lockfile } from "@katacut/core";

describe("mergeLock", () => {
  it("preserves unrelated entries and resolvedVersion", () => {
    const prev: Lockfile = {
      version: "1",
      client: "claude-code",
      mcpServers: {
        x: { scope: "project", fingerprint: "fp-x", resolvedVersion: "1.2.3" },
      },
    };
    const next: Lockfile = {
      version: "1",
      client: "claude-code",
      mcpServers: {
        a: { scope: "project", fingerprint: "fp-a" },
      },
    };
    const res = mergeLock(prev, next);
    expect(res.client).toBe("claude-code");
    expect(Object.keys(res.mcpServers).sort()).toEqual(["a", "x"]);
    expect(res.mcpServers.x.resolvedVersion).toBe("1.2.3");
  });

  it("keeps previous resolvedVersion when next doesn't provide it", () => {
    const prev: Lockfile = {
      version: "1",
      client: "claude-code",
      mcpServers: {
        a: { scope: "project", fingerprint: "old", resolvedVersion: "2.0.0" },
      },
    };
    const next: Lockfile = {
      version: "1",
      client: "claude-code",
      mcpServers: {
        a: { scope: "project", fingerprint: "new" },
      },
    };
    const res = mergeLock(prev, next);
    expect(res.mcpServers.a.fingerprint).toBe("new");
    expect(res.mcpServers.a.resolvedVersion).toBe("2.0.0");
  });

  it("overwrites resolvedVersion when next provides it", () => {
    const prev: Lockfile = {
      version: "1",
      client: "claude-code",
      mcpServers: {
        a: { scope: "project", fingerprint: "old", resolvedVersion: "1.0.0" },
      },
    };
    const next: Lockfile = {
      version: "1",
      client: "claude-code",
      mcpServers: {
        a: { scope: "project", fingerprint: "new", resolvedVersion: "1.1.0" },
      },
    };
    const res = mergeLock(prev, next);
    expect(res.mcpServers.a.fingerprint).toBe("new");
    expect(res.mcpServers.a.resolvedVersion).toBe("1.1.0");
  });
});

