import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: ".",
  testMatch: ["browser.audit.ts", "settings.browser.audit.ts", "concurrent.browser.audit.ts"],
  timeout: 180000,
  workers: 1,
  reporter: "list",
  outputDir: "../../test-results/audit-2026-10-23/browser",
  use: {
    baseURL: "http://127.0.0.1:5198",
    viewport: { width: 390, height: 844 },
    launchOptions: {
      executablePath: process.env.SEEDS_CHROMIUM,
      args: ["--no-sandbox"],
    },
  },
  webServer: {
    command: "npx vite preview --host 127.0.0.1 --port 5198",
    cwd: new URL("../..", import.meta.url).pathname,
    url: "http://127.0.0.1:5198",
    reuseExistingServer: false,
  },
});
