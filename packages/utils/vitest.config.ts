import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		passWithNoTests: true,
		pool: "threads",
		name: "utils",
		root: __dirname,
		include: ["test/**/*.test.{ts,tsx}"],
		environment: "node",
	},
});
