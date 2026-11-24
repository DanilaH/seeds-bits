import {defineConfig} from "@playwright/test";
import base from "./playwright.config";

export default defineConfig({
  ...base, testIgnore: [], testMatch:"markets.spec.ts", workers:1,
  outputDir:"test-results/markets",
  use:{...base.use,baseURL:"http://127.0.0.1:5187",timezoneId:"Asia/Yekaterinburg"},
  webServer:{command:"VITE_SEEDS_FIRST_SESSION=1 VITE_SEEDS_MARKET_QA=1 npx vite --mode yandex --host 127.0.0.1 --port 5187",
    url:"http://127.0.0.1:5187",reuseExistingServer:false},
});
