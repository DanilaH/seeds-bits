import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "e2e",
  use: {
    launchOptions: process.env.SEEDS_CHROMIUM
      ? { executablePath: process.env.SEEDS_CHROMIUM, args: ["--no-sandbox"] }
      : {},
    baseURL: "http://127.0.0.1:5173",
    viewport: { width: 390, height: 844 },
  },
  webServer: {
    command: "npx vite --host 127.0.0.1 --port 5173",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: !process.env.CI,
  },
  reporter: "list",
});
