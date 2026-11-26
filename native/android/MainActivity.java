package com.seedsbits.game.preview;
import android.content.res.Configuration;
import android.os.Bundle;
import android.os.Build;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import androidx.core.view.WindowCompat;
import org.json.JSONObject;
import com.getcapacitor.BridgeActivity;
public class MainActivity extends BridgeActivity {
  private boolean gameDark;
  @Override public void onCreate(Bundle savedInstanceState) {
    try {
      String saved = getSharedPreferences("CapacitorStorage", MODE_PRIVATE).getString("seeds-bits.settings.v1", "{}");
      gameDark = "dark".equals(new JSONObject(saved).optString("theme", "light"));
    } catch (Exception ignored) { gameDark = false; }
    SeedsApplication.initializeAnalytics(getApplication());
    registerPlugin(SeedsMonetizationPlugin.class);
    registerPlugin(SeedsEngagementPlugin.class);
    registerPlugin(SeedsFeedbackPlugin.class);
    registerPlugin(SeedsAppearancePlugin.class);
    super.onCreate(savedInstanceState);
    applyGameAppearance();
  }

  @Override protected void load() {
    super.load();
    applyGameTextZoom();
    applyGameAppearance();
  }

  @Override public void onResume() {
    super.onResume();
    applyGameTextZoom();
    applyGameAppearance();
  }

  @Override public void onConfigurationChanged(Configuration configuration) {
    super.onConfigurationChanged(configuration);
    applyGameTextZoom();
    applyGameAppearance();
  }

  public boolean isGameDark() { return gameDark; }

  public void setGameAppearance(boolean dark) {
    gameDark = dark;
    applyGameAppearance();
  }

  @SuppressWarnings("deprecation")
  private void applyGameAppearance() {
    int top = Color.parseColor(gameDark ? "#303e31" : "#e5ddbe");
    int bottom = Color.parseColor(gameDark ? "#233127" : "#c5be9f");
    // Paint behind transparent system bars on API35+, without changing content
    // insets, the WebView rectangle, SDK banner slot, or system navigation mode.
    getWindow().setBackgroundDrawable(new GradientDrawable(
      GradientDrawable.Orientation.TOP_BOTTOM, new int[]{top, bottom}));
    getWindow().setStatusBarColor(top);
    getWindow().setNavigationBarColor(bottom);
    if (Build.VERSION.SDK_INT >= 29) {
      getWindow().setStatusBarContrastEnforced(false);
      getWindow().setNavigationBarContrastEnforced(false);
    }
    var controller = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
    controller.setAppearanceLightStatusBars(!gameDark);
    controller.setAppearanceLightNavigationBars(!gameDark);
  }

  private void applyGameTextZoom() {
    if (getBridge() != null) {
      getBridge().getWebView().getSettings().setTextZoom(100);
    }
  }
}
