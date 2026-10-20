import { defineConfig } from "vitest/config";
export default defineConfig({
  test: { include: ["scripts/audit-0.4.0/*.audit.ts"] },
});
