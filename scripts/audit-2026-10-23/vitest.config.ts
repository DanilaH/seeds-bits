import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    include: ["scripts/audit-2026-10-23/model.audit.ts"],
    testTimeout: 240000,
  },
});
