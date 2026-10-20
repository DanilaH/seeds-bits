import { defineConfig } from "vitest/config";
export default defineConfig({
  test: { include: ["scripts/audit-0.5.1/*.audit.ts"], testTimeout: 120000 },
});
