import { defineConfig } from "vitest/config";

// Native ESM for benchmarks: the module runner's export getters skew hot-path timings
const isBench = process.argv.includes("bench");

export default defineConfig({
  test: {
    experimental: { viteModuleRunner: !isBench },
    coverage: {
      enabled: true,
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts"],
    },
  },
});
