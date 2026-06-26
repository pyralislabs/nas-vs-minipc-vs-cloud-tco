import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "json-summary"],
      thresholds: {
        statements: 95,
        branches: 90,
        functions: 95,
        lines: 95,
      },
      include: ["src/**/*.ts"],
      exclude: [
        "src/widget/**",
        "src/cli/**",
        "src/index.ts",
        "src/schema/currencies.ts",
        "src/schema/locales.ts",
        "src/schema/limits.ts",
      ],
    },
  },
});
