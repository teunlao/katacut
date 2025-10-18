import { stableStringify } from "@katacut/utils";
import { describe, expect, it } from "vitest";

describe("stableStringify", () => {
	it("orders object keys deterministically", () => {
		const a = { b: 1, a: 2 };
		const b = { a: 2, b: 1 };
		expect(stableStringify(a)).toBe(stableStringify(b));
	});

	it("preserves array order", () => {
		expect(stableStringify([2, 1])).not.toBe(stableStringify([1, 2]));
	});
});
