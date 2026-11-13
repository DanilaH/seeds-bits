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
  : process.env.SEEDS_HELP_QA === "1" ? "com.seedsbits.game.assistqa" : "com.seedsbits.game.preview";
const version = JSON.parse(readFileSync("package.json", "utf8")).version;
const [major, minor, patch] = version.split(".").map(Number);
const build = Number(process.env.GITHUB_RUN_NUMBER || 1);
if (
  ![major, minor, patch].every(Number.isSafeInteger) ||
  minor > 9 ||
  patch > 99 ||
  build > 999
)
  throw Error("Version/build outside Android version-code range");
const versionCode = storeRelease
  ? major * 1000000 + minor * 100000 + patch * 1000 + build
  : 11100 + build;
if (!Number.isSafeInteger(versionCode) || versionCode < 1001)
  throw Error("Invalid version");
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
// Preview builds never send QA traffic into the release counter implicitly.
const qaKey = (process.env.APPMETRICA_QA_API_KEY || "").trim();
if (qaKey && !/^[0-9a-f-]{36}$/i.test(qaKey))
  throw Error("Invalid format: APPMETRICA_QA_API_KEY");
if (!storeRelease) values.APPMETRICA_API_KEY = qaKey;
const test = process.env.ADS_MODE !== "live";
if (storeRelease && (test || process.env.REQUIRE_MOBILE_CONFIG !== "true"))
  throw Error("Store builds require checked live configuration");
let gradle = readFileSync(path, "utf8")
  .replace(/versionCode \d+/, `versionCode ${versionCode}`)
  .replace(/versionName "[^"]+"/, `versionName "${version}"`);
gradle = gradle
  .replace("minifyEnabled false", "minifyEnabled true")
  .replace("proguard-android.txt", "proguard-android-optimize.txt");
if (!gradle.includes("shrinkResources true"))
  gradle = gradle.replace(
    "minifyEnabled true",
    "minifyEnabled true\n            shrinkResources true",
  );
if (
  !gradle.includes("minifyEnabled true") ||
  !gradle.includes("shrinkResources true")
)
  throw Error("Release optimization configuration missing");
copyFileSync(
  "native/android/proguard-rules.pro",
  "android/app/proguard-rules.pro",
);
if (!gradle.includes("// seeds SDKs"))
  gradle += `\n// seeds SDKs\ndependencies {\n  implementation 'com.yandex.android:mobileads:8.5.0'\n  implementation 'io.appmetrica.analytics:analytics:8.6.0'\n  implementation 'ru.rustore.sdk:review:10.5.2'\n}\n`;
writeFileSync(path, gradle);
if (!gradle.includes(`applicationId "${appId}"`))
  throw Error("Generated Android package does not match build flavor");
const java = `android/app/src/main/java/${appId.replaceAll(".", "/")}`;
mkdirSync(java, { recursive: true });
for (const name of [
  "MainActivity",
  "SeedsApplication",
  "SeedsMonetizationPlugin",
  "SeedsEngagementPlugin",
  "SeedsFeedbackPlugin",
  "SeedsDailyReminder",
  "SeedsAdRevenue",
]) {
  const source = readFileSync(`native/android/${name}.java`, "utf8").replace(
    "package com.seedsbits.game.preview;",
    `package ${appId};`,
  );
  writeFileSync(`${java}/${name}.java`, source);
}
const rootGradle = "android/build.gradle";
let rootScript = readFileSync(rootGradle, "utf8");
if (!rootScript.includes("maven-rustore-exposed"))
  rootScript = rootScript.replace(
    /repositories \{/g,
    'repositories {\n        maven { url "https://nexus-external.rustore.ru/repository/maven-rustore-exposed" }',
  );
writeFileSync(rootGradle, rootScript);
copyFileSync(
  "native/android/notification-icon.xml",
  "android/app/src/main/res/drawable/ic_seed_notification.xml",
);
const xmlPath = "android/app/src/main/res/values/seeds-services.xml";
const escape = (s) =>
  s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");
writeFileSync(
  xmlPath,
  `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n<string name="appmetrica_api_key" translatable="false">${escape(values.APPMETRICA_API_KEY)}</string>\n<string name="yandex_banner_id" translatable="false">${escape(values.YANDEX_BANNER_AD_UNIT_ID || (test ? "demo-banner-yandex" : ""))}</string>\n<string name="yandex_interstitial_id" translatable="false">${escape(values.YANDEX_INTERSTITIAL_AD_UNIT_ID)}</string>\n<string name="yandex_rewarded_id" translatable="false">${escape(values.YANDEX_REWARDED_AD_UNIT_ID)}</string>\n<string name="analytics_channel" translatable="false">${storeRelease ? "release" : "preview"}</string>\n<bool name="ads_test_mode">${test}</bool>\n</resources>\n`,
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
if (!manifest.includes("android.permission.POST_NOTIFICATIONS"))
  manifest = manifest.replace(
    "<application",
    '<uses-permission android:name="android.permission.POST_NOTIFICATIONS"/><uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/><application',
  );
if (!manifest.includes('android:name=".SeedsDailyReminder"'))
  manifest = manifest.replace(
    "</application>",
    '<receiver android:name=".SeedsDailyReminder" android:exported="false"><intent-filter><action android:name="android.intent.action.BOOT_COMPLETED"/><action android:name="android.intent.action.TIME_SET"/><action android:name="android.intent.action.TIMEZONE_CHANGED"/><action android:name="android.intent.action.MY_PACKAGE_REPLACED"/></intent-filter></receiver></application>',
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
for (const name of ["launcher-art", "adaptive-art"]) {
  const old = `${res}/drawable/${name.replaceAll("-", "_")}.png`;
  if (readdirSync(`${res}/drawable`).includes(old.split("/").at(-1)))
    unlinkSync(old);
  copyFileSync(
    `native/android/branding/${name}.webp`,
    `${res}/drawable/${name.replaceAll("-", "_")}.webp`,
  );
}
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
