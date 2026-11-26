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
  private Boolean paintedDark;
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
    applyGameAppearance(false);
  }

  public boolean isGameDark() { return gameDark; }

  public void setGameAppearance(boolean dark) {
    gameDark = dark;
    applyGameAppearance();
  }

  private void applyGameAppearance() { applyGameAppearance(true); }

  @SuppressWarnings("deprecation")
  private void applyGameAppearance(boolean repaint) {
    int top = Color.parseColor(gameDark ? "#303e31" : "#e5ddbe");
    int bottom = Color.parseColor(gameDark ? "#233127" : "#c5be9f");
    // API24–25 cannot draw dark navigation icons. Keep a dark palette color
    // behind their mandatory light icons, rather than losing contrast.
    if (Build.VERSION.SDK_INT < 26 && !gameDark) bottom = Color.parseColor("#34553f");
    // Paint behind transparent system bars on API35+, without changing content
    // insets, the WebView rectangle, SDK banner slot, or system navigation mode.
    // Splash/Activity restoration may replace the Window background independently
    // of the saved palette. uiMode alone can reuse the painted palette.
    if (repaint || paintedDark == null || paintedDark != gameDark) {
      getWindow().setBackgroundDrawable(new GradientDrawable(
        GradientDrawable.Orientation.TOP_BOTTOM, new int[]{top, bottom}));
      getWindow().setStatusBarColor(top);
      getWindow().setNavigationBarColor(bottom);
      if (Build.VERSION.SDK_INT >= 29) {
        getWindow().setStatusBarContrastEnforced(false);
        getWindow().setNavigationBarContrastEnforced(false);
      }
      paintedDark = gameDark;
    }
    var controller = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
    if (controller.isAppearanceLightStatusBars() != !gameDark) controller.setAppearanceLightStatusBars(!gameDark);
    if (controller.isAppearanceLightNavigationBars() != !gameDark) controller.setAppearanceLightNavigationBars(!gameDark);
  }

  private void applyGameTextZoom() {
    if (getBridge() != null) {
      getBridge().getWebView().getSettings().setTextZoom(100);
    }
  }
}
