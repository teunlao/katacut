import { KatacutError } from "@katacut/utils";
import { describe, expect, it } from "vitest";

describe("KatacutError", () => {
	it("sets name and message", () => {
		const err = new KatacutError("x");
		expect(err.name).toBe("KatacutError");
		expect(err.message).toBe("x");
	});
});
