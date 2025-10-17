import { defineConfig } from "vitest/config";
export default defineConfig({
    test: {
        passWithNoTests: true,
        pool: "threads",
        name: "adapter-client-claude",
        root: __dirname,
        include: ["test/**/*.test.{ts,tsx}"],
        environment: "node",
    },
});
//# sourceMappingURL=vitest.config.js.map