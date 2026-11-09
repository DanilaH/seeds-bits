package com.seedsbits.game.preview;
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
}
