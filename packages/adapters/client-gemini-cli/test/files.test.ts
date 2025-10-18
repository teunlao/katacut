import { describe, it, expect } from "vitest";
import { readProjectGemini, readUserGemini } from "../src/files.js";
import { mkdtemp, writeFile, rm, mkdir } from "node:fs/promises";
import { join } from "node:path";

describe("Gemini CLI file readers", () => {
  it("reads project .gemini/settings.json mcpServers", async () => {
    const dir = await mkdtemp(join(process.cwd(), ".tmp-gemini-"));
    try {
      await mkdir(join(dir, ".gemini"));
      await writeFile(
        join(dir, ".gemini", "settings.json"),
        JSON.stringify({ mcpServers: { fs: { command: "npx", args: ["-y", "@modelcontextprotocol/server-filesystem"] } } }),
      );
      const res = await readProjectGemini(dir);
      expect(res.source).toBe(join(dir, ".gemini", "settings.json"));
      expect(Object.keys(res.mcpServers)).toEqual(["fs"]);
      expect(res.mcpServers.fs.type).toBe("stdio");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("reads SSE (url) entries as type sse", async () => {
    const dir = await mkdtemp(join(process.cwd(), ".tmp-gemini-"));
    try {
      await mkdir(join(dir, ".gemini"));
      await writeFile(
        join(dir, ".gemini", "settings.json"),
        JSON.stringify({ mcpServers: { sseSrv: { url: "https://example.org/sse", headers: { A: "b" } } } }),
      );
      const res = await readProjectGemini(dir);
      expect(Object.keys(res.mcpServers)).toEqual(["sseSrv"]);
      expect(res.mcpServers.sseSrv.type).toBe("sse");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("returns empty when nothing found in user scope", async () => {
    const res = await readUserGemini();
    expect(res.mcpServers && typeof res.mcpServers).toBe("object");
  });
});
