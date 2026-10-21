import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    include: ["scripts/regression-061/model.audit.ts"],
    testTimeout: 120000,
  },
});
