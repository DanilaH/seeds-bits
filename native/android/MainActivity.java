package com.seedsbits.game.preview;
import android.content.res.Configuration;
import android.os.Bundle;
import android.os.Build;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.view.View;
import android.view.ViewTreeObserver;
import androidx.core.view.WindowCompat;
import org.json.JSONObject;
import com.getcapacitor.BridgeActivity;
public class MainActivity extends BridgeActivity {
  private boolean gameDark;
  private Boolean paintedDark;
  private GradientDrawable gameBackground;
  private boolean appearanceGuardInstalled;
  private final ViewTreeObserver.OnPreDrawListener appearanceGuard = () -> { repairGameAppearance(); return true; };
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
  public boolean isGameBackgroundApplied() { return getWindow().getDecorView().getBackground() == gameBackground; }

  public void setGameAppearance(boolean dark) {
    gameDark = dark;
    applyGameAppearance();
  }

  @SuppressWarnings("deprecation")
  private void applyGameAppearance() {
    View decor = getWindow().getDecorView();
    if (!appearanceGuardInstalled) {
      decor.getViewTreeObserver().addOnPreDrawListener(appearanceGuard);
      appearanceGuardInstalled = true;
    }
    if (Build.VERSION.SDK_INT < 35) {
      getWindow().setStatusBarColor(Color.parseColor(gameDark ? "#303e31" : "#e5ddbe"));
      getWindow().setNavigationBarColor(Color.parseColor(gameDark ? "#233127" : Build.VERSION.SDK_INT < 26 ? "#34553f" : "#c5be9f"));
    }
    if (Build.VERSION.SDK_INT >= 29) {
      getWindow().setStatusBarContrastEnforced(false);
      getWindow().setNavigationBarContrastEnforced(false);
    }
    repairGameAppearance();
  }

  private void repairGameAppearance() {
    View decor = getWindow().getDecorView();
    if (gameBackground == null || paintedDark != gameDark) {
      int top = Color.parseColor(gameDark ? "#303e31" : "#e5ddbe");
      int bottom = Color.parseColor(gameDark ? "#233127" : Build.VERSION.SDK_INT < 26 ? "#34553f" : "#c5be9f");
      gameBackground = new GradientDrawable(GradientDrawable.Orientation.TOP_BOTTOM, new int[]{top, bottom});
      paintedDark = gameDark;
    }
    // Capacitor SystemBars.setStyle replaces the DecorView background on startup,
    // reload and uiMode. Own the palette at draw time while preserving its insets.
    if (decor.getBackground() != gameBackground) {
      int left=decor.getPaddingLeft(), top=decor.getPaddingTop(), right=decor.getPaddingRight(), bottom=decor.getPaddingBottom();
      decor.setBackground(gameBackground);
      decor.setPadding(left, top, right, bottom);
    }
    var controller = WindowCompat.getInsetsController(getWindow(), decor);
    if (controller.isAppearanceLightStatusBars() != !gameDark) controller.setAppearanceLightStatusBars(!gameDark);
    if (controller.isAppearanceLightNavigationBars() != !gameDark) controller.setAppearanceLightNavigationBars(!gameDark);
  }

  @Override public void onDestroy() {
    var observer = getWindow().getDecorView().getViewTreeObserver();
    if (appearanceGuardInstalled && observer.isAlive()) observer.removeOnPreDrawListener(appearanceGuard);
    super.onDestroy();
  }

  private void applyGameTextZoom() {
    if (getBridge() != null) {
      getBridge().getWebView().getSettings().setTextZoom(100);
    }
  }
}
