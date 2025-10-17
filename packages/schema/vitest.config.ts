import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		passWithNoTests: true,
		pool: "threads",
		name: "schema",
		root: __dirname,
		include: ["test/**/*.test.{ts,tsx}"],
		environment: "node",
	},
});
