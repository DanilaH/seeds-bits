import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  copyFileSync,
  readdirSync,
  unlinkSync,
} from "node:fs";
const path = "android/app/build.gradle";
const storeRelease = process.env.SEEDS_BUILD_FLAVOR === "release";
const appId = storeRelease
  ? "com.seedsbits.game"
  : "com.seedsbits.game.preview";
const versionCode =
  (storeRelease ? 1000000 : 1000) + Number(process.env.GITHUB_RUN_NUMBER || 1);
if (!Number.isSafeInteger(versionCode) || versionCode < 1001)
  throw Error("Invalid version");
const version = JSON.parse(readFileSync("package.json", "utf8")).version;
const names = [
  "APPMETRICA_API_KEY",
  "YANDEX_BANNER_AD_UNIT_ID",
  "YANDEX_INTERSTITIAL_AD_UNIT_ID",
  "YANDEX_REWARDED_AD_UNIT_ID",
];
const values = Object.fromEntries(
  names.map((n) => [n, (process.env[n] || "").trim()]),
);
if (process.env.REQUIRE_MOBILE_CONFIG === "true") {
  const missing = names.filter((n) => !values[n]);
  if (missing.length)
    throw Error("Missing GitHub Actions configuration: " + missing.join(", "));
}
for (const [name, value] of Object.entries(values)) {
  if (
    value &&
    !(
      name === "APPMETRICA_API_KEY" ? /^[0-9a-f-]{36}$/i : /^R-M-\d+-\d+$/
    ).test(value)
  )
    throw Error("Invalid format: " + name);
}
const test = process.env.ADS_MODE !== "live";
if (storeRelease && (test || process.env.REQUIRE_MOBILE_CONFIG !== "true"))
  throw Error("Store builds require checked live configuration");
let gradle = readFileSync(path, "utf8")
  .replace(/versionCode \d+/, `versionCode ${versionCode}`)
  .replace(/versionName "[^"]+"/, `versionName "${version}"`);
if (!gradle.includes("// seeds SDKs"))
  gradle += `\n// seeds SDKs\ndependencies {\n  implementation 'com.yandex.android:mobileads:8.5.0'\n  implementation 'io.appmetrica.analytics:analytics:8.6.0'\n}\n`;
writeFileSync(path, gradle);
if (!gradle.includes(`applicationId "${appId}"`))
  throw Error("Generated Android package does not match build flavor");
const java = `android/app/src/main/java/${appId.replaceAll(".", "/")}`;
mkdirSync(java, { recursive: true });
for (const name of [
  "MainActivity",
  "SeedsApplication",
  "SeedsMonetizationPlugin",
]) {
  const source = readFileSync(`native/android/${name}.java`, "utf8").replace(
    "package com.seedsbits.game.preview;",
    `package ${appId};`,
  );
  writeFileSync(`${java}/${name}.java`, source);
}
const xmlPath = "android/app/src/main/res/values/seeds-services.xml";
const escape = (s) =>
  s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");
writeFileSync(
  xmlPath,
  `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n<string name="appmetrica_api_key" translatable="false">${escape(values.APPMETRICA_API_KEY)}</string>\n<string name="yandex_banner_id" translatable="false">${escape(values.YANDEX_BANNER_AD_UNIT_ID || (test ? "demo-banner-yandex" : ""))}</string>\n<string name="yandex_interstitial_id" translatable="false">${escape(values.YANDEX_INTERSTITIAL_AD_UNIT_ID)}</string>\n<string name="yandex_rewarded_id" translatable="false">${escape(values.YANDEX_REWARDED_AD_UNIT_ID)}</string>\n<bool name="ads_test_mode">${test}</bool>\n</resources>\n`,
);
const manifestPath = "android/app/src/main/AndroidManifest.xml";
let manifest = readFileSync(manifestPath, "utf8");
if (!manifest.includes('android:name=".SeedsApplication"'))
  manifest = manifest.replace(
    "<application",
    '<application android:name=".SeedsApplication"',
  );
if (!manifest.includes("AUTOMATIC_SDK_INITIALIZATION"))
  manifest = manifest.replace(
    "</application>",
    '<meta-data android:name="com.yandex.mobile.ads.AUTOMATIC_SDK_INITIALIZATION" android:value="false" /></application>',
  );
manifest = manifest.replace(
  'android:allowBackup="true"',
  'android:allowBackup="false"',
);
if (storeRelease && !manifest.includes("android:usesCleartextTraffic="))
  manifest = manifest.replace(
    "<application",
    '<application android:usesCleartextTraffic="false"',
  );
writeFileSync(manifestPath, manifest);
// Store, legacy launcher and splash share the selected 3 + 7 artwork.
// Adaptive artwork includes extra gradient margin for Android masks.
const res = "android/app/src/main/res";
for (const [density, size] of Object.entries({
  mdpi: 48,
  hdpi: 72,
  xhdpi: 96,
  xxhdpi: 144,
  xxxhdpi: 192,
})) {
  mkdirSync(`${res}/mipmap-${density}`, { recursive: true });
  for (const name of ["ic_launcher", "ic_launcher_round"])
    copyFileSync(
      `native/android/branding/icon-${size}.png`,
      `${res}/mipmap-${density}/${name}.png`,
    );
}
for (const dir of ["drawable", "mipmap-anydpi-v26", "values"])
  mkdirSync(`${res}/${dir}`, { recursive: true });
for (const name of ["ic_launcher", "ic_launcher_round"])
  copyFileSync(
    "native/android/branding/adaptive.xml",
    `${res}/mipmap-anydpi-v26/${name}.xml`,
  );
copyFileSync(
  "native/android/branding/seed-mark.xml",
  `${res}/drawable/seed_mark.xml`,
);
for (const name of ["launcher-art", "adaptive-art"])
  copyFileSync(
    `native/android/branding/${name}.png`,
    `${res}/drawable/${name.replaceAll("-", "_")}.png`,
  );
writeFileSync(
  `${res}/values/seeds-brand.xml`,
  '<resources><color name="seed_paper">#f6f7f4</color></resources>',
);
writeFileSync(
  `${res}/drawable/splash.xml`,
  '<layer-list xmlns:android="http://schemas.android.com/apk/res/android"><item android:drawable="@color/seed_paper"/><item android:gravity="center" android:width="144dp" android:height="144dp" android:drawable="@drawable/seed_mark"/></layer-list>',
);
for (const dir of readdirSync(res).filter((dir) =>
  dir.startsWith("drawable"),
)) {
  for (const file of readdirSync(`${res}/${dir}`))
    if (file === "splash.png") unlinkSync(`${res}/${dir}/${file}`);
}
const stylesPath = `${res}/values/styles.xml`;
let styles = readFileSync(stylesPath, "utf8").replace(
  /<style name="AppTheme.NoActionBarLaunch"[\s\S]*?<\/style>/,
  `<style name="AppTheme.NoActionBarLaunch" parent="Theme.SplashScreen">
  <item name="android:background">@drawable/splash</item>
  <item name="windowSplashScreenBackground">@color/seed_paper</item>
  <item name="windowSplashScreenAnimatedIcon">@drawable/seed_mark</item>
  <item name="postSplashScreenTheme">@style/AppTheme.NoActionBar</item>
</style>`,
);
writeFileSync(stylesPath, styles);
console.log(
  `Android ${version} (${versionCode}); ads mode: ${test ? "test" : "live"}; configured fields: ${names.filter((n) => values[n]).length}/4. Values are not logged.`,
);
