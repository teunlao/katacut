import { describe, it, expect } from "vitest";
import { assert } from "@katacut/utils";
import { KatacutError } from "@katacut/utils";

describe("assert", () => {
  it("does not throw when condition is truthy", () => {
    expect(() => assert(true, "nope")).not.toThrow();
  });

  it("throws KatacutError with provided message when falsy", () => {
    expect(() => assert(false, "bad"))
      .toThrow(new KatacutError("bad"));
  });
});

