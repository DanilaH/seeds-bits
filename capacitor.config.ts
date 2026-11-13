import type { CapacitorConfig } from "@capacitor/cli";
const storeRelease = process.env.SEEDS_BUILD_FLAVOR === "release";
const config: CapacitorConfig = {
  appId: storeRelease ? "com.seedsbits.game" : process.env.SEEDS_HELP_QA === "1" ? "com.seedsbits.game.assistqa" : "com.seedsbits.game.preview",
  appName: storeRelease ? "Семечки" : process.env.SEEDS_HELP_QA === "1" ? "Семечки · помощь QA" : "Семечки · тест",
  webDir: "dist",
  backgroundColor: "#f6f7f4",
};
export default config;
