import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, basename } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { DEFAULT_CONFIG_FILENAMES, resolveConfigPath } from "../src/config.js";

const tempDirs: string[] = [];

async function createTempDir() {
  const dir = await mkdtemp(join(tmpdir(), "katacut-config-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (!dir) continue;
    await rm(dir, { recursive: true, force: true });
  }
});

describe("resolveConfigPath", () => {
  it("returns undefined when no config file exists", async () => {
    const cwd = await createTempDir();
    const result = await resolveConfigPath({ cwd });
    expect(result).toBeUndefined();
  });

  it("returns the path of katacut.json when it is the only file", async () => {
    const cwd = await createTempDir();
    const target = join(cwd, "katacut.json");
    await writeFile(target, "{}");

    const result = await resolveConfigPath({ cwd });
    expect(result).toBe(target);
  });

  it("follows the configured priority order", async () => {
    const cwd = await createTempDir();

    for (const filename of DEFAULT_CONFIG_FILENAMES.slice(2)) {
      await writeFile(join(cwd, filename), "{}");
    }

    const expected = join(cwd, DEFAULT_CONFIG_FILENAMES[0]);
    await writeFile(expected, "{}");

    const result = await resolveConfigPath({ cwd });
    expect(result).toBe(expected);
  });

  it("prefers katacut.config.json over katacut.jsonc", async () => {
    const cwd = await createTempDir();
    const lowerPriority = join(cwd, "katacut.jsonc");
    const higherPriority = join(cwd, "katacut.config.json");

    await writeFile(lowerPriority, "{}");
    await writeFile(higherPriority, "{}");

    const result = await resolveConfigPath({ cwd });
    expect(result && basename(result)).toBe("katacut.config.json");
  });
});
