import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: ".",
  testMatch: "browser.spec.ts",
  timeout: 20000,
  workers: 1,
  expect: { timeout: 3000 },
  use: {
    baseURL: "http://127.0.0.1:5198",
    viewport: { width: 390, height: 844 },
    launchOptions: {
      executablePath: "/tmp/seeds-audit-chromium",
      args: ["--no-sandbox"],
    },
  },
  webServer: {
    command:
      "python3 -m http.server 5198 --bind 127.0.0.1 --directory /tmp/seeds051-audit-apk",
    url: "http://127.0.0.1:5198",
    reuseExistingServer: true,
  },
  outputDir: "../../docs/audit-0.5.1/browser-results",
  reporter: [
    ["list"],
    ["json", { outputFile: "../../docs/audit-0.5.1/browser-results.json" }],
  ],
});
