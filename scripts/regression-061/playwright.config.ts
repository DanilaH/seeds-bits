import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: ".",
  testMatch: "browser.audit.ts",
  timeout: 30000,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:5186",
    viewport: { width: 390, height: 844 },
    launchOptions: {
      ...(process.env.SEEDS_CHROMIUM
        ? { executablePath: process.env.SEEDS_CHROMIUM }
        : {}),
      args: ["--no-sandbox"],
    },
  },
  webServer: {
    cwd: new URL("../..", import.meta.url).pathname,
    command: "npx vite --host 127.0.0.1 --port 5186",
    url: "http://127.0.0.1:5186",
    reuseExistingServer: true,
  },
  outputDir: "../../test-results/regression061",
  reporter: "list",
});
