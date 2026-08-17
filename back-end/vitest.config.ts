import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/bootstrap/**"],
      thresholds: { statements: 60, branches: 60, functions: 60, lines: 60 },
    },
  },
});
