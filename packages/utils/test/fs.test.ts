import { describe, it, expect } from "vitest";
import { readTextFile, readConfigFile } from "@katacut/utils";
import { writeFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

async function withTempDir<T>(fn: (dir: string) => Promise<T>) {
  const dir = await mkdtemp(join(tmpdir(), "kc-utils-"));
  try { return await fn(dir); } finally { await rm(dir, { recursive: true, force: true }); }
}

describe("fs utils", () => {
  it("reads text file with cwd", async () => withTempDir(async (dir) => {
    const file = join(dir, "a.txt");
    await writeFile(file, "hello", "utf8");
    const data = await readTextFile("a.txt", { cwd: dir });
    expect(data).toBe("hello");
  }));

  it("readConfigFile proxies to readTextFile", async () => withTempDir(async (dir) => {
    const file = join(dir, "c.jsonc");
    await writeFile(file, "{\n  \"x\": 1\n}", "utf8");
    const data = await readConfigFile("c.jsonc", { cwd: dir });
    expect(JSON.parse(data)).toEqual({ x: 1 });
  }));
});

