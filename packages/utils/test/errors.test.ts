import { describe, it, expect } from "vitest";
import { KatacutError } from "@katacut/utils";

describe("KatacutError", () => {
  it("sets name and message", () => {
    const err = new KatacutError("x");
    expect(err.name).toBe("KatacutError");
    expect(err.message).toBe("x");
  });
});

