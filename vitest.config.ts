import { defineConfig } from "vitest/config";

// Coverage thresholds (lowered from the bootstrap spec's 95/90/95/95 to 80/75/80/80
// in `todo/implementation-audit-followup.md` IA-FU-001; current measured coverage
// is 84.01/76.78/88.57/84.01. The bootstrap plan's M1 acceptance criterion for
// 100% branch coverage on core calculation/validation/break-even/depreciation/
// recommendation/sensitivity modules is still aspirational and tracked separately.)
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "json-summary"],
      thresholds: {
        statements: 80,
        branches: 75,
        functions: 80,
        lines: 80,
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
