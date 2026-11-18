import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/**/types.ts"],
      reporter: ["text", "html"],
      thresholds: {
        // SOW requirement: validation coverage ≥ 90%. Checked in CI.
        "src/vault/**": { statements: 90, branches: 90, functions: 90, lines: 90 },
        statements: 85,
        branches: 85,
        functions: 85,
        lines: 85,
      },
    },
  },
});
