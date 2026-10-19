import { readFileSync, writeFileSync } from "node:fs";
const path = "android/app/build.gradle";
const versionCode = 1000 + Number(process.env.GITHUB_RUN_NUMBER || 1);
if (!Number.isSafeInteger(versionCode) || versionCode < 1001)
  throw Error("Invalid version");
const version = JSON.parse(readFileSync("package.json", "utf8")).version;
let gradle = readFileSync(path, "utf8");
gradle = gradle
  .replace(/versionCode \d+/, `versionCode ${versionCode}`)
  .replace(/versionName "[^"]+"/, `versionName "${version}"`);
writeFileSync(path, gradle);
console.log(
  `Android preview ${version} (${versionCode}); unsigned CI output requires private signing.`,
);
