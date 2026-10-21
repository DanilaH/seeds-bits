import {defineConfig}from'vitest/config';export default defineConfig({test:{include:['scripts/audit-0.6.0/model.audit.ts'],testTimeout:120000}});
