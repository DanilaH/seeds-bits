import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: ".",
  testMatch: "browser.spec.ts",
  timeout: 45000,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:5198",
    viewport: { width: 390, height: 844 },
    launchOptions: {
      executablePath: "/tmp/seeds-audit-chromium",
      args: ["--no-sandbox"],
    },
    screenshot: "only-on-failure",
  },
  webServer: {
    command:
      "python -m http.server 5198 --bind 127.0.0.1 --directory /tmp/seeds-audit040-web",
    url: "http://127.0.0.1:5198",
    reuseExistingServer: false,
  },
  outputDir: "../../test-results/audit040",
  reporter: [
    ["list"],
    ["json", { outputFile: "../../docs/audit-0.4.0/browser-results.json" }],
  ],
});
