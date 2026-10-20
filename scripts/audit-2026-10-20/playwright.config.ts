import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "node:url";
import base from "../../playwright.config";
export default defineConfig({
  ...base,
  testDir: ".",
  testMatch: "browser.spec.ts",
  webServer: {
    ...base.webServer,
    cwd: fileURLToPath(new URL("../../", import.meta.url)),
  },
});
