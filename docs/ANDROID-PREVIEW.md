# Android test builds from 0.3.0

The previously distributed `com.seedsbits.game` APKs used ephemeral CI debug certificates. Those private keys were not retained. A new key cannot update those APKs in place.

0.3.0 uses **`com.seedsbits.game.preview`**, displayed as **Семечки · тест**. It installs alongside the old app. Keep the old app installed to retain its progress. The new app starts with its own storage; there is no automatic migration.

The permanent preview signing record is kept privately as `seeds-android-signing-private.json`, outside this repository. It contains the PKCS12 key and password; never commit it or put it in a public CI artifact. Future delivered preview APKs must use that same record. This is a test key/package, not a claim of production-store readiness.

CI's `seeds-bits-android-preview-intermediate` artifact is an intermediate APK with a disposable signature. **Do not deliver that artifact directly.** Re-sign it using `scripts/sign-preview.py --input app-debug.apk --output seeds-preview.apk --key-record /private/path/to/record.json --apksigner /path/to/apksigner.jar`. The script verifies the resulting signature. Record the certificate fingerprint in the release report and compare on subsequent releases. Private CI signing can later be configured using a repository secret; no secret is required or exposed by the current workflow.

`scripts/configure-android.mjs` sets versionName from package.json and versionCode to 1000 + GITHUB_RUN_NUMBER. Locally it defaults to 1001; supply GITHUB_RUN_NUMBER for local releases to avoid version regression.

## Optional old-debug migration

`scripts/migrate-debug-save.py --backup seeds-old-save.xml` is a local ADB migration helper. It requires an authorised single connected Android device, both apps installed, and Python/ADB on the user's computer. It stops both apps, reads the OLD app's Capacitor preferences, writes a local backup, preserves any existing new-app preferences as a second backup, copies preferences into the NEW app, then compares XML. It never uninstalls the old app or alters its saved file. The APK remains debuggable specifically to allow this development-only path.

The helper has not been exercised on a real phone in this environment. Do not describe migration as completed or guaranteed. If run-as fails, stop; do not suggest uninstalling the old app. Retain the old app and the backup until the copied progress is visibly verified on the phone.
