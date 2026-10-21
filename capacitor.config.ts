import type { CapacitorConfig } from "@capacitor/cli";
const storeRelease = process.env.SEEDS_BUILD_FLAVOR === "release";
const config: CapacitorConfig = {
  appId: storeRelease ? "com.seedsbits.game" : "com.seedsbits.game.preview",
  appName: storeRelease ? "Семечки" : "Семечки · тест",
  webDir: "dist",
  backgroundColor: "#f6f7f4",
};
export default config;
