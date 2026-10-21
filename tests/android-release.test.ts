import { test, expect } from "vitest";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  cpSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
const script = resolve("scripts/configure-android.mjs");
function fixture(release = true) {
  const root = mkdtempSync(join(tmpdir(), "seeds-release-"));
  mkdirSync(join(root, "android/app"), { recursive: true });
  const tar = spawnSync("tar", [
    "--no-same-owner",
    "-xzf",
    resolve("node_modules/@capacitor/cli/assets/android-template.tar.gz"),
    "-C",
    join(root, "android"),
  ]);
  if (tar.status) throw Error(String(tar.stderr));
  const file = join(root, "android/app/build.gradle"),
    app = release ? "com.seedsbits.game" : "com.seedsbits.game.preview";
  writeFileSync(
    file,
    readFileSync(file, "utf8").replace("com.getcapacitor.app", app),
  );
  cpSync("native", join(root, "native"), { recursive: true });
  cpSync("package.json", join(root, "package.json"));
  return root;
}
const env = {
  ...process.env,
  SEEDS_BUILD_FLAVOR: "release",
  REQUIRE_MOBILE_CONFIG: "true",
  ADS_MODE: "live",
  GITHUB_RUN_NUMBER: "7",
  APPMETRICA_API_KEY: "00000000-0000-0000-0000-000000000001",
  YANDEX_BANNER_AD_UNIT_ID: "R-M-1-1",
  YANDEX_INTERSTITIAL_AD_UNIT_ID: "R-M-1-2",
  YANDEX_REWARDED_AD_UNIT_ID: "R-M-1-3",
};
test("store configuration keeps live IDs, correct namespace and branding and is repeatable", () => {
  const root = fixture();
  try {
    for (let n = 0; n < 2; n++) {
      const r = spawnSync("node", [script], {
        cwd: root,
        env,
        encoding: "utf8",
      });
      expect(r.status, r.stderr).toBe(0);
    }
    const read = (p: string) => readFileSync(join(root, p), "utf8");
    expect(read("android/app/build.gradle")).toContain("versionCode 1000007");
    expect(
      read(
        "android/app/src/main/java/com/seedsbits/game/SeedsMonetizationPlugin.java",
      ),
    ).toContain("package com.seedsbits.game;");
    const manifest = read("android/app/src/main/AndroidManifest.xml");
    expect(manifest).toContain('android:allowBackup="false"');
    expect(manifest.match(/android:usesCleartextTraffic=/g)).toHaveLength(1);
    const xml = read("android/app/src/main/res/values/seeds-services.xml");
    expect(xml).toContain('name="ads_test_mode">false');
    expect(xml).not.toContain("demo-");
    expect(read("android/app/src/main/res/values/styles.xml")).toContain(
      "windowSplashScreenAnimatedIcon",
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
test("store configuration rejects demo mode and missing production IDs", () => {
  const root = fixture();
  try {
    expect(
      spawnSync("node", [script], {
        cwd: root,
        env: { ...env, ADS_MODE: "test" },
      }).status,
    ).not.toBe(0);
    expect(
      spawnSync("node", [script], {
        cwd: root,
        env: { ...env, YANDEX_REWARDED_AD_UNIT_ID: "" },
      }).status,
    ).not.toBe(0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
