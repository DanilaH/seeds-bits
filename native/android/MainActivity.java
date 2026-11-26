package com.seedsbits.game.preview;
import android.content.res.Configuration;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
public class MainActivity extends BridgeActivity {
  @Override public void onCreate(Bundle savedInstanceState) {
    SeedsApplication.initializeAnalytics(getApplication());
    registerPlugin(SeedsMonetizationPlugin.class);
    registerPlugin(SeedsEngagementPlugin.class);
    registerPlugin(SeedsFeedbackPlugin.class);
    super.onCreate(savedInstanceState);
  }

  @Override protected void load() {
    super.load();
    applyGameTextZoom();
  }

  @Override public void onResume() {
    super.onResume();
    applyGameTextZoom();
  }

  @Override public void onConfigurationChanged(Configuration configuration) {
    super.onConfigurationChanged(configuration);
    applyGameTextZoom();
  }

  private void applyGameTextZoom() {
    if (getBridge() != null) {
      getBridge().getWebView().getSettings().setTextZoom(100);
    }
  }
}
