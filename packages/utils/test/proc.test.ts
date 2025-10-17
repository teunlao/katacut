import { describe, it, expect } from "vitest";
import { execCapture } from "@katacut/utils";

describe("execCapture", () => {
  it("captures stdout and exit code 0", async () => {
    const res = await execCapture(process.execPath, ["-e", "process.stdout.write('ok')"]);
    expect(res.code).toBe(0);
    expect(res.stdout).toBe("ok");
  });

  it("returns 127 for missing binary", async () => {
    const res = await execCapture("definitely-missing-binary-xyz", []);
    expect(res.code).toBe(127);
  });
});

