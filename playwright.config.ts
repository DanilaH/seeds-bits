import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "e2e",
  testIgnore: ["first-session.spec.ts", "markets.spec.ts", "final-tutorial50.spec.ts"],
  outputDir: "test-results/main",
  timeout: 90000,
  workers: 2,
  use: {
    launchOptions: process.env.SEEDS_CHROMIUM
      ? { executablePath: process.env.SEEDS_CHROMIUM, args: ["--no-sandbox"] }
      : {},
    locale: "ru-RU",
    baseURL: "http://127.0.0.1:5173",
    viewport: { width: 390, height: 844 },
  },
  webServer: {
    // Historical short-course fault fixtures run explicitly as legacy QA.
    // Product entry and the production bundle have separate first-session gates.
    env: {VITE_SEEDS_FIRST_SESSION: process.env.VITE_SEEDS_FIRST_SESSION ?? "0"},
    command: "npx vite --host 127.0.0.1 --port 5173",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: !process.env.CI,
  },
  reporter: "list",
});
