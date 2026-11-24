import {defineConfig} from "@playwright/test";
import base from "./playwright.config";
export default defineConfig({
  ...base,
  testIgnore: [],
  testMatch: "first-session.spec.ts",
  outputDir: "test-results/first-session-browser",
  workers: 2,
  use: {...base.use, baseURL:"http://127.0.0.1:5186", timezoneId:"Asia/Yekaterinburg"},
  webServer: {
    command:"VITE_SEEDS_FIRST_SESSION=1 VITE_SEEDS_QA_PROFILE=baseline npx vite --host 127.0.0.1 --port 5186",
    url:"http://127.0.0.1:5186", reuseExistingServer:false,
  },
});
