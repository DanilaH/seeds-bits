package com.seedsbits.game.preview;

import android.content.SharedPreferences;
import android.content.res.Configuration;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.yandex.mobile.ads.banner.BannerAdView;
import com.yandex.mobile.ads.banner.BannerAdSize;
import com.yandex.mobile.ads.banner.BannerAdEventListener;
import com.yandex.mobile.ads.common.*;
import com.yandex.mobile.ads.interstitial.*;
import com.yandex.mobile.ads.rewarded.*;
import io.appmetrica.analytics.AppMetrica;
import java.util.UUID;

@CapacitorPlugin(name = "SeedsMonetization")
public class SeedsMonetizationPlugin extends Plugin {
  private static final long INTERVAL = 180000L, RETRY = 60000L;
  private final Handler handler = new Handler(Looper.getMainLooper());
  private SharedPreferences prefs;
  private boolean initialized, destroyed, resumed = true, loadingInterstitial, loadingRewarded;
  private long lastInterstitialRequest, lastRewardedRequest, lastBannerRequest;
  private InterstitialAdLoader interstitialLoader;
  private RewardedAdLoader rewardedLoader;
  private InterstitialAd interstitial;
  private RewardedAd rewarded;
  private BannerAdView banner;
  private FrameLayout bannerHost;
  private int bannerWidth;
  private PluginCall showing;
  private String showingKind, showingAttempt;
  private boolean shown;
  private Runnable showDeadline;

  @Override public void load() {
    prefs = getContext().getSharedPreferences("seeds-monetization", 0);
    if (!prefs.contains("last_fullscreen")) prefs.edit().putLong("last_fullscreen", System.currentTimeMillis()).apply();
    getActivity().runOnUiThread(() -> {
      YandexAds.initialize(getContext(), () -> {
        if (destroyed) return;
        initialized = true;
        interstitialLoader = new InterstitialAdLoader(getContext());
        rewardedLoader = new RewardedAdLoader(getContext());
        preloadAds();
      });
    });
  }
  private boolean enabled() { return !getContext().getString(R.string.yandex_banner_id).isEmpty(); }
  private String unit(String kind) {
    boolean test = getContext().getResources().getBoolean(R.bool.ads_test_mode);
    if (test) return "demo-" + kind + "-yandex";
    return getContext().getString(kind.equals("banner") ? R.string.yandex_banner_id : kind.equals("rewarded") ? R.string.yandex_rewarded_id : R.string.yandex_interstitial_id);
  }
  private void event(String name, String kind) {
    if (!getContext().getString(R.string.appmetrica_api_key).isEmpty())
      AppMetrica.reportEvent(name, new JSObject().put("format", kind).put("test", getContext().getResources().getBoolean(R.bool.ads_test_mode)).toString());
  }
  private JSObject receipt() {
    String token = prefs.getString("reward_token", "");
    return token.isEmpty() ? null : new JSObject().put("token", token).put("attempt", prefs.getString("reward_attempt", ""));
  }
  @PluginMethod public void initialize(PluginCall call) {
    JSObject result = new JSObject().put("enabled", enabled()).put("test", getContext().getResources().getBoolean(R.bool.ads_test_mode));
    JSObject reward = receipt(); if (reward != null) result.put("reward", reward);
    call.resolve(result);
  }
  @PluginMethod public void pending(PluginCall call) {
    JSObject result = new JSObject(); JSObject reward = receipt(); if (reward != null) result.put("reward", reward); call.resolve(result);
  }
  @PluginMethod public void acknowledge(PluginCall call) {
    if (call.getString("token", "").equals(prefs.getString("reward_token", "")))
      prefs.edit().remove("reward_token").remove("reward_attempt").commit();
    call.resolve();
  }
  @PluginMethod public void report(PluginCall call) {
    String name = call.getString("name", "");
    if (name.matches("game_(start|complete)|hint_(used|offer|reward_granted)|save_error")) {
      JSObject data = call.getObject("data", new JSObject());
      data.put("test", getContext().getResources().getBoolean(R.bool.ads_test_mode));
      if (!getContext().getString(R.string.appmetrica_api_key).isEmpty()) AppMetrica.reportEvent(name, data.toString());
    }
    call.resolve();
  }
  @PluginMethod public void preload(PluginCall call) { getActivity().runOnUiThread(this::preloadAds); call.resolve(); }
  private void preloadAds() {
    if (!initialized || destroyed || !enabled() || !resumed) return;
    long now = SystemClock.elapsedRealtime();
    if (interstitial == null && !loadingInterstitial && (lastInterstitialRequest == 0 || now - lastInterstitialRequest >= RETRY)) {
      loadingInterstitial = true; lastInterstitialRequest = now; event("ad_request", "interstitial");
      interstitialLoader.loadAd(new AdRequest.Builder(unit("interstitial")).build(), new InterstitialAdLoadListener() {
        @Override public void onAdLoaded(@NonNull InterstitialAd ad) {
          loadingInterstitial = false; if (!destroyed) { interstitial = ad; event("ad_loaded", "interstitial"); }
        }
        @Override public void onAdFailedToLoad(@NonNull AdRequestError error) { loadingInterstitial = false; event("ad_load_error", "interstitial"); }
      });
    }
    if (rewarded == null && !loadingRewarded && (lastRewardedRequest == 0 || now - lastRewardedRequest >= RETRY)) {
      loadingRewarded = true; lastRewardedRequest = now; event("ad_request", "rewarded");
      rewardedLoader.loadAd(new AdRequest.Builder(unit("rewarded")).build(), new RewardedAdLoadListener() {
        @Override public void onAdLoaded(@NonNull RewardedAd ad) {
          loadingRewarded = false; if (!destroyed) { rewarded = ad; event("ad_loaded", "rewarded"); }
        }
        @Override public void onAdFailedToLoad(@NonNull AdRequestError error) { loadingRewarded = false; event("ad_load_error", "rewarded"); }
      });
    }
  }
  @PluginMethod public void show(PluginCall call) { getActivity().runOnUiThread(() -> showOnMain(call)); }
  private void showOnMain(PluginCall call) {
    String kind = call.getString("kind", "");
    if (!kind.equals("rewarded") && !kind.equals("interstitial")) { call.reject("Invalid format"); return; }
    if (destroyed || !resumed || showing != null || !initialized || !enabled()) { call.resolve(new JSObject().put("status", "unavailable")); return; }
    long since = System.currentTimeMillis() - prefs.getLong("last_fullscreen", System.currentTimeMillis());
    if (kind.equals("interstitial") && (since < INTERVAL || interstitial == null)) {
      call.resolve(new JSObject().put("status", "skipped")); preloadAds(); return;
    }
    if (kind.equals("rewarded") && (rewarded == null || receipt() != null || call.getString("attempt", "").isEmpty())) {
      JSObject result = new JSObject().put("status", "unavailable"); if (receipt() != null) result.put("reward", receipt());
      call.resolve(result); preloadAds(); return;
    }
    showing = call; showingKind = kind; showingAttempt = call.getString("attempt", ""); shown = false;
    if (bannerHost != null) bannerHost.setVisibility(View.GONE);
    // A missing pre-show callback must not leave the game blocked indefinitely.
    showDeadline = () -> { if (!shown && showing != null) finish("error"); };
    handler.postDelayed(showDeadline, 15000);
    try {
      if (kind.equals("interstitial")) {
        interstitial.setAdEventListener(new InterstitialAdEventListener() {
          @Override public void onAdShown() { didShow(); }
          @Override public void onAdDismissed() { finish("closed"); }
          @Override public void onAdFailedToShow(@NonNull AdError e) { finish("error"); }
          @Override public void onAdClicked() { event("ad_clicked", "interstitial"); }
          @Override public void onAdImpression(@Nullable ImpressionData data) { event("ad_impression", "interstitial"); }
        });
        interstitial.show(getActivity());
      } else {
        rewarded.setAdEventListener(new RewardedAdEventListener() {
          @Override public void onAdShown() { didShow(); }
          @Override public void onAdDismissed() { finish("closed"); }
          @Override public void onAdFailedToShow(@NonNull AdError e) { finish("error"); }
          @Override public void onAdClicked() { event("ad_clicked", "rewarded"); }
          @Override public void onAdImpression(@Nullable ImpressionData data) { event("ad_impression", "rewarded"); }
          @Override public void onRewarded(@NonNull Reward reward) {
            if (showing == null || !prefs.getString("reward_token", "").isEmpty()) return;
            String token = UUID.randomUUID().toString();
            if (prefs.edit().putString("reward_token", token).putString("reward_attempt", showingAttempt).commit()) {
              event("ad_reward_earned", "rewarded"); notifyListeners("reward", receipt(), true);
            }
          }
        });
        rewarded.show(getActivity());
      }
    } catch (Exception e) { finish("error"); }
  }
  private void didShow() {
    if (showing == null) return;
    shown = true; handler.removeCallbacks(showDeadline);
    prefs.edit().putLong("last_fullscreen", System.currentTimeMillis()).apply();
    event("ad_shown", showingKind);
  }
  private void finish(String status) {
    if (showing == null) return;
    handler.removeCallbacks(showDeadline);
    JSObject result = new JSObject().put("shown", shown).put("status", status);
    if (showingKind.equals("rewarded") && receipt() != null) result.put("reward", receipt());
    event(status.equals("error") ? "ad_show_error" : "ad_closed", showingKind);
    if (shown) prefs.edit().putLong("last_fullscreen", System.currentTimeMillis()).apply();
    if (showingKind.equals("rewarded")) { if (rewarded != null) rewarded.setAdEventListener(null); rewarded = null; lastRewardedRequest = 0; }
    else { if (interstitial != null) interstitial.setAdEventListener(null); interstitial = null; lastInterstitialRequest = 0; }
    PluginCall call = showing; showing = null; showingAttempt = null; call.resolve(result);
    preloadAds();
  }
  private void clearBanner() {
    if (banner != null) { banner.setBannerAdEventListener(null); banner.destroy(); banner = null; }
    if (bannerHost != null) { ((ViewGroup)bannerHost.getParent()).removeView(bannerHost); bannerHost = null; }
    bannerWidth = 0;
  }
  @PluginMethod public void banner(PluginCall call) { getActivity().runOnUiThread(() -> {
    if (!initialized || destroyed || !enabled() || showing != null || !resumed || !call.getBoolean("visible", false)) {
      if (bannerHost != null) bannerHost.setVisibility(View.GONE); call.resolve(); return;
    }
    View web = getBridge().getWebView();
    FrameLayout root = getActivity().findViewById(android.R.id.content);
    float scale = web.getWidth() / Math.max(1f, call.getFloat("viewportWidth", 1f));
    int width = Math.round(call.getFloat("width", 0f) * scale), height = Math.round(call.getFloat("height", 0f) * scale);
    int[] webLocation = new int[2], rootLocation = new int[2]; web.getLocationOnScreen(webLocation); root.getLocationOnScreen(rootLocation);
    int left = webLocation[0] - rootLocation[0] + Math.round(call.getFloat("x", 0f) * scale);
    int top = webLocation[1] - rootLocation[1] + Math.round(call.getFloat("y", 0f) * scale);
    if (width < 1 || height < 1 || left < 0 || top < 0 || top + height > root.getHeight()) { if (bannerHost != null) bannerHost.setVisibility(View.GONE); call.resolve(); return; }
    if (banner != null && bannerWidth != width) clearBanner();
    if (banner == null) {
      long now = SystemClock.elapsedRealtime();
      if (lastBannerRequest != 0 && now - lastBannerRequest < RETRY) { call.resolve(); return; }
      int dp = Math.round(width / getContext().getResources().getDisplayMetrics().density);
      BannerAdSize size = BannerAdSize.sticky(getContext(), dp);
      if (size.getHeightInPixels(getContext()) > height) { call.resolve(); return; }
      bannerWidth = width; lastBannerRequest = now;
      bannerHost = new FrameLayout(getContext()); root.addView(bannerHost);
      banner = new BannerAdView(getActivity()); banner.setAdSize(size);
      bannerHost.addView(banner, new FrameLayout.LayoutParams(width, size.getHeightInPixels(getContext()), android.view.Gravity.CENTER));
      banner.setBannerAdEventListener(new BannerAdEventListener() {
        @Override public void onAdLoaded() { if (destroyed) clearBanner(); else event("ad_loaded", "banner"); }
        @Override public void onAdFailedToLoad(@NonNull AdRequestError e) { event("ad_load_error", "banner"); clearBanner(); /* Retry only on a later action after RETRY. */ }
        @Override public void onAdClicked() { event("ad_clicked", "banner"); }
        @Override public void onImpression(@Nullable ImpressionData data) { event("ad_impression", "banner"); }
      });
      event("ad_request", "banner"); banner.loadAd(new AdRequest.Builder(unit("banner")).build());
    }
    FrameLayout.LayoutParams layout = new FrameLayout.LayoutParams(width, height); layout.leftMargin = left; layout.topMargin = top;
    bannerHost.setLayoutParams(layout); bannerHost.setVisibility(View.VISIBLE); call.resolve();
  }); }
  @Override protected void handleOnConfigurationChanged(Configuration config) { clearBanner(); lastBannerRequest = 0; }
  @Override protected void handleOnPause() { resumed = false; if (bannerHost != null) bannerHost.setVisibility(View.GONE); }
  @Override protected void handleOnResume() { resumed = true; preloadAds(); }
  @Override protected void handleOnDestroy() {
    destroyed = true; handler.removeCallbacksAndMessages(null); clearBanner();
    if (interstitial != null) interstitial.setAdEventListener(null);
    if (rewarded != null) rewarded.setAdEventListener(null);
    if (showing != null) { showing.resolve(new JSObject().put("status", "interrupted")); showing = null; }
  }
}
