package com.seedsbits.game.preview;
import android.app.Application;
import android.content.Context;
import android.content.pm.PackageInfo;
import com.getcapacitor.JSObject;
import io.appmetrica.analytics.AppMetrica;
import io.appmetrica.analytics.AppMetricaConfig;
public class SeedsApplication extends Application {
  private static boolean analyticsInitialized;
  /** A local alarm/boot receiver is not a player's return to the game. */
  static synchronized void initializeAnalytics(Application application) {
    if (analyticsInitialized) return;
    String key=application.getString(R.string.appmetrica_api_key);
    if (!key.isEmpty()) {
      AppMetrica.activate(application,AppMetricaConfig.newConfigBuilder(key).withLocationTracking(false).build());
      AppMetrica.enableActivityAutoTracking(application);
      analyticsInitialized=true;
    }
  }
  /** Common non-personal context. `test` stays compatible and describes ads only. */
  static void report(Context context, String name, JSObject data) {
    if (context.getString(R.string.appmetrica_api_key).isEmpty()) return;
    data.put("build_channel", context.getString(R.string.analytics_channel));
    boolean test = context.getResources().getBoolean(R.bool.ads_test_mode);
    data.put("test", test).put("ads_test", test);
    data.put("schema", 3);
    android.content.SharedPreferences prefs = context.getSharedPreferences("seeds-monetization",0);
    for (String field : new String[]{"install","experiment","variant","config","anchor","cohort","qa"})
      if (prefs.contains("context_"+field)) data.put(field,prefs.getString("context_"+field,""));
    try {
      PackageInfo info = context.getPackageManager().getPackageInfo(context.getPackageName(), 0);
      data.put("app_version", info.versionName).put("app_build", info.versionCode);
    } catch (Exception ignored) { /* SDK still provides its own version dimensions. */ }
    AppMetrica.reportEvent(name, data.toString());
  }
}
