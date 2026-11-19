package com.seedsbits.game.preview;

import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.InstallSourceInfo;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.os.Build;

final class SeedsInstallStore {
  static final String KEY = "install_store";
  private static final String UNKNOWN = "unknown";

  private SeedsInstallStore() {}

  static String capture(Context context) {
    SharedPreferences preferences =
        context.getSharedPreferences("seeds-monetization", Context.MODE_PRIVATE);
    String recorded = preferences.getString(KEY, null);
    if (recorded != null) return recorded;

    String store = detect(context.getPackageManager(), context.getPackageName());
    preferences.edit().putString(KEY, store).apply();
    return store;
  }

  static String read(SharedPreferences preferences) {
    return preferences.getString(KEY, UNKNOWN);
  }

  @SuppressWarnings("deprecation")
  private static String detect(PackageManager packages, String appPackage) {
    try {
      PackageInfo app = packages.getPackageInfo(appPackage, 0);
      // An upgrade from a build without attribution can describe the updater instead of the installer.
      if (app.firstInstallTime <= 0 || app.firstInstallTime != app.lastUpdateTime) return UNKNOWN;

      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
        InstallSourceInfo source = packages.getInstallSourceInfo(appPackage);
        String initiatingStore = classify(source.getInitiatingPackageName());
        return UNKNOWN.equals(initiatingStore)
            ? classify(source.getInstallingPackageName())
            : initiatingStore;
      }
      return classify(packages.getInstallerPackageName(appPackage));
    } catch (PackageManager.NameNotFoundException | SecurityException ignored) {
      return UNKNOWN;
    }
  }

  private static String classify(String installer) {
    if ("ru.vk.store".equals(installer)) return "rustore";
    if ("com.nashstore".equals(installer)) return "nashstore";
    return UNKNOWN;
  }
}
