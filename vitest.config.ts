import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		globals: true,
		passWithNoTests: true,
		include: [],
		projects: [
			{
				extends: true,
				test: {
					name: "schema",
					include: ["packages/schema/**/*.test.{ts,tsx}"],
					environment: "node",
				},
			},
			{
				extends: true,
				test: {
					name: "core",
					include: ["packages/core/**/*.test.{ts,tsx}"],
					environment: "node",
				},
			},
			{
				extends: true,
				test: {
					name: "cli",
					include: ["packages/cli/**/*.test.{ts,tsx}"],
					environment: "node",
				},
			},
			{
				extends: true,
				test: {
					name: "utils",
					include: ["packages/utils-*/**/*.test.{ts,tsx}"],
					environment: "node",
				},
			},
			{
				extends: true,
				test: {
					name: "adapters",
					include: ["packages/adapters/**/*.test.{ts,tsx}"],
					environment: "node",
				},
			},
		],
	},
});
