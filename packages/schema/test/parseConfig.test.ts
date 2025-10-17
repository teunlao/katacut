import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { parseConfig } from "../src/index.js";

const fixture = (name: string) =>
	readFile(resolve(__dirname, "__fixtures__", name), "utf8");

describe("parseConfig", () => {
	it("parses valid configuration", async () => {
		const source = await fixture("valid-basic.jsonc");
		const result = parseConfig(source);

		expect(result.issues).toHaveLength(0);
		expect(result.config).toMatchObject({
			version: "0.1.0",
			mcp: {
				github: { transport: "http", url: "https://api.example.com/mcp" }
			}
		});
	});

	it("reports validation errors", async () => {
		const source = await fixture("invalid-missing-transport.jsonc");
		const result = parseConfig(source);

		expect(result.issues.length).toBeGreaterThan(0);
		expect(result.issues[0].message).toMatch(/transport/);
	});

	it("reports parse errors", () => {
		const result = parseConfig("{ invalid }");
		expect(result.issues[0]?.message).toBeDefined();
	});
});
