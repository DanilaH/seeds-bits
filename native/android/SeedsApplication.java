package com.seedsbits.game.preview;
import android.app.Application;
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
}
