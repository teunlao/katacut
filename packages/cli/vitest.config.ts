import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		passWithNoTests: true,
		pool: "threads",
		name: "cli",
		root: __dirname,
		include: ["test/**/*.test.{ts,tsx}"],
		environment: "node",
		setupFiles: ["./vitest.setup.ts"],
	},
});
