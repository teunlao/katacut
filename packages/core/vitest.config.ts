import baseConfig from "../../vitest.base.ts";
import { defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(
	baseConfig,
	defineConfig({
		test: {
			name: "core",
			root: __dirname,
			include: ["test/**/*.test.{ts,tsx}"],
			environment: "node"
		}
	})
);
