import { defineConfig, mergeConfig } from "vitest/config";
import baseConfig from "../../vitest.base.ts";

export default mergeConfig(
	baseConfig,
	defineConfig({
		test: {
			name: "schema",
			root: __dirname,
			include: ["test/**/*.test.{ts,tsx}"],
			environment: "node",
		},
	}),
);
