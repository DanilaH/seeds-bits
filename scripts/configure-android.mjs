import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
const path = "android/app/build.gradle";
const versionCode = 1000 + Number(process.env.GITHUB_RUN_NUMBER || 1);
if (!Number.isSafeInteger(versionCode) || versionCode < 1001) throw Error("Invalid version");
const version = JSON.parse(readFileSync("package.json", "utf8")).version;
const names = ["APPMETRICA_API_KEY", "YANDEX_BANNER_AD_UNIT_ID", "YANDEX_INTERSTITIAL_AD_UNIT_ID", "YANDEX_REWARDED_AD_UNIT_ID"];
const values = Object.fromEntries(names.map(n => [n, (process.env[n] || "").trim()]));
if (process.env.REQUIRE_MOBILE_CONFIG === "true") {
  const missing = names.filter(n => !values[n]);
  if (missing.length) throw Error("Missing GitHub Actions configuration: " + missing.join(", "));
}
for (const [name, value] of Object.entries(values)) {
  if (value && !(name === "APPMETRICA_API_KEY" ? /^[0-9a-f-]{36}$/i : /^R-M-\d+-\d+$/).test(value)) throw Error("Invalid format: " + name);
}
const test = process.env.ADS_MODE !== "live";
let gradle = readFileSync(path, "utf8").replace(/versionCode \d+/, `versionCode ${versionCode}`).replace(/versionName "[^"]+"/, `versionName "${version}"`);
if (!gradle.includes("// seeds SDKs")) gradle += `\n// seeds SDKs\ndependencies {\n  implementation 'com.yandex.android:mobileads:8.5.0'\n  implementation 'io.appmetrica.analytics:analytics:8.6.0'\n}\n`;
writeFileSync(path, gradle);
const java = "android/app/src/main/java/com/seedsbits/game/preview";
mkdirSync(java, { recursive: true });
for (const name of ["MainActivity", "SeedsApplication", "SeedsMonetizationPlugin"]) copyFileSync(`native/android/${name}.java`, `${java}/${name}.java`);
const xmlPath = "android/app/src/main/res/values/seeds-services.xml";
const escape = s => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");
writeFileSync(xmlPath, `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n<string name="appmetrica_api_key" translatable="false">${escape(values.APPMETRICA_API_KEY)}</string>\n<string name="yandex_banner_id" translatable="false">${escape(values.YANDEX_BANNER_AD_UNIT_ID || (test ? "demo-banner-yandex" : ""))}</string>\n<string name="yandex_interstitial_id" translatable="false">${escape(values.YANDEX_INTERSTITIAL_AD_UNIT_ID)}</string>\n<string name="yandex_rewarded_id" translatable="false">${escape(values.YANDEX_REWARDED_AD_UNIT_ID)}</string>\n<bool name="ads_test_mode">${test}</bool>\n</resources>\n`);
const manifestPath = "android/app/src/main/AndroidManifest.xml";
let manifest = readFileSync(manifestPath, "utf8");
if (!manifest.includes('android:name=".SeedsApplication"')) manifest = manifest.replace("<application", '<application android:name=".SeedsApplication"');
if (!manifest.includes("AUTOMATIC_SDK_INITIALIZATION")) manifest = manifest.replace("</application>", '<meta-data android:name="com.yandex.mobile.ads.AUTOMATIC_SDK_INITIALIZATION" android:value="false" /></application>');
writeFileSync(manifestPath, manifest);
console.log(`Android ${version} (${versionCode}); ads mode: ${test ? "test" : "live"}; configured fields: ${names.filter(n => values[n]).length}/4. Values are not logged.`);
