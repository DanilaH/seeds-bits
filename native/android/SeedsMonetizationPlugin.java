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
import org.json.JSONArray;
import java.util.UUID;

@CapacitorPlugin(name = "SeedsMonetization")
public class SeedsMonetizationPlugin extends Plugin {
  static volatile boolean fullscreenActive;
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
  private int bannerPixelHeight;
  private int bannerCssHeight;
  private PluginCall showing;
  private String showingKind, showingAttempt, showingProduct, showingIntent, showingOffer, showingSession;
  private boolean shown, rewardIssued;
  private JSObject heldReceipt;
  private boolean receiptNeedsSave;
  private BannerPlacement bannerPlacement;
  private static final class BannerPlacement {
    final boolean visible;
    final float x, y, width, height, viewportWidth;
    BannerPlacement(PluginCall call) {
      visible = call.getBoolean("visible", false);
      x = call.getFloat("x", 0f); y = call.getFloat("y", 0f);
      width = call.getFloat("width", 0f); height = call.getFloat("height", 0f);
      viewportWidth = call.getFloat("viewportWidth", 1f);
    }
  }
  private Runnable showDeadline;

  @Override public void load() {
    fullscreenActive=false;
    prefs = getContext().getSharedPreferences("seeds-monetization", 0);
    if (!prefs.contains("last_fullscreen")) prefs.edit().putLong("last_fullscreen", System.currentTimeMillis()).apply();
    getActivity().runOnUiThread(() -> {
      YandexAds.initialize(getContext(), () -> getActivity().runOnUiThread(() -> {
        if (destroyed) return;
        initialized = true;
        interstitialLoader = new InterstitialAdLoader(getContext());
        rewardedLoader = new RewardedAdLoader(getContext());
        preloadAds();
        if (bannerPlacement != null) applyBanner(bannerPlacement);
      }));
    });
  }
  private boolean enabled() { return !getContext().getString(R.string.yandex_banner_id).isEmpty(); }
  private String unit(String kind) {
    boolean test = getContext().getResources().getBoolean(R.bool.ads_test_mode);
    if (test) return "demo-" + kind + "-yandex";
    return getContext().getString(kind.equals("banner") ? R.string.yandex_banner_id : kind.equals("rewarded") ? R.string.yandex_rewarded_id : R.string.yandex_interstitial_id);
  }
  private void event(String name, String kind) {
    try {
      JSObject data = new JSObject().put("format", kind);
      if (showing != null && kind.equals(showingKind)) data.put("ad_session_id",showingSession).put("product",showingProduct).put("intent_id",showingIntent).put("offer_id",showingOffer);
      SeedsApplication.report(getContext(), name, data);
    }
    catch (Exception ignored) { /* Optional telemetry cannot interrupt an ad callback. */ }
  }
  private JSObject storedReceipt() {
    String token = prefs.getString("reward_token", "");
    if (token.isEmpty()) return null;
    JSObject result = new JSObject().put("token", token).put("attempt", prefs.getString("reward_attempt", ""));
    if (prefs.contains("reward_version")) {
      try { result.put("version", Integer.parseInt(prefs.getString("reward_version", "0"))); } catch (Exception ignored) { result.put("version", 0); }
      result.put("product", prefs.getString("reward_product", ""));
      result.put("intent_id", prefs.getString("reward_intent", "")); result.put("offer_id", prefs.getString("reward_offer", ""));
      result.put("ad_session_id", prefs.getString("reward_session", ""));
    }
    return result;
  }
  private boolean persistReceipt(JSObject reward) {
    SharedPreferences.Editor edit = prefs.edit().putString("reward_token",reward.optString("token","")).putString("reward_attempt",reward.optString("attempt",""));
    if (!reward.optString("version","").isEmpty()) edit.putString("reward_version",reward.optString("version",""))
      .putString("reward_product",reward.optString("product","")).putString("reward_intent",reward.optString("intent_id",""))
      .putString("reward_offer",reward.optString("offer_id","")).putString("reward_session",reward.optString("ad_session_id",""));
    return edit.commit();
  }
  private JSObject receipt() {
    if (heldReceipt == null) { heldReceipt = storedReceipt(); receiptNeedsSave = heldReceipt != null; }
    if (heldReceipt != null && receiptNeedsSave) {
      if (!persistReceipt(heldReceipt)) return null;
      receiptNeedsSave = false;
    }
    return heldReceipt;
  }
  private boolean pendingReceipt() { return receipt() != null || heldReceipt != null; }
  private JSObject rewardedState() {
    String state = "unavailable", reason = "not_loaded";
    if (destroyed || !enabled()) { state = "disabled"; reason = "disabled"; }
    else if (pendingReceipt()) reason = "pending_receipt";
    else if (!resumed) reason = "background";
    else if (showing != null) reason = "fullscreen_busy";
    else if (loadingRewarded || !initialized) { state = "loading"; reason = "loading"; }
    else if (rewarded != null) { state = "ready"; reason = "ready"; }
    return new JSObject().put("state", state).put("reason", reason);
  }
  private void publishReadiness() { notifyListeners("rewardedState", rewardedState(), true); }
  @PluginMethod public void readiness(PluginCall call) { getActivity().runOnUiThread(() -> call.resolve(rewardedState())); }
  @PluginMethod public void initialize(PluginCall call) {
    JSObject result = new JSObject().put("enabled", enabled()).put("test", getContext().getResources().getBoolean(R.bool.ads_test_mode));
    JSObject reward = receipt(); if (reward != null) result.put("reward", reward);
    result.put("readiness", rewardedState()); call.resolve(result);
  }
  @PluginMethod public void pending(PluginCall call) {
    JSObject result = new JSObject(); JSObject reward = receipt(); if (reward != null) result.put("reward", reward); call.resolve(result);
  }
  @PluginMethod public void acknowledge(PluginCall call) {
    JSObject reward = receipt();
    // A failed SharedPreferences commit can mutate its in-memory map. Retain the
    // receipt independently until a disk-backed removal has actually succeeded.
    if (reward != null && call.getString("token", "").equals(reward.optString("token", ""))) {
      if (!prefs.edit().remove("reward_token").remove("reward_attempt").remove("reward_version").remove("reward_product").remove("reward_intent").remove("reward_offer").remove("reward_session").commit()) {
        receiptNeedsSave = true; call.reject("Reward acknowledgement could not be saved"); return;
      }
      heldReceipt = null; receiptNeedsSave = false;
    } else if (heldReceipt != null) { call.reject("Pending reward is not durable"); return; }
    publishReadiness(); call.resolve();
  }
  // Preferences.set uses apply(): reward receipts must wait for an actual disk commit.
  @PluginMethod public void persistState(PluginCall call) {
    String key = call.getString("key", ""), settingsKey = call.getString("settingsKey", "");
    if (!key.equals("seeds-bits.progress.v2") || !settingsKey.equals("seeds-bits.settings.v1")) {
      call.reject("Invalid storage keys"); return;
    }
    try {
      boolean saved = getContext().getSharedPreferences("CapacitorStorage", 0).edit()
        .putString(key, call.getString("value", ""))
        .putString(settingsKey, call.getString("settings", "")).commit();
      if (!saved) { call.reject("Progress could not be saved", "DISK_COMMIT"); return; }
      // A reminder failure cannot turn an already durable game write into an error.
      try { SeedsDailyReminder.sync(getContext()); } catch (Exception ignored) {}
      call.resolve();
    } catch (Exception error) {call.reject("Progress could not be saved", "PERSIST_EXCEPTION");}
  }

  @PluginMethod public void configureContext(PluginCall call) {
    SharedPreferences.Editor edit = prefs.edit();
    for (String key : new String[]{"install","experiment","variant","config","anchor","cohort","qa"}) {
      String value = call.getString(key, "");
      if (value.length() > 100) { call.reject("Invalid experiment context"); return; }
      edit.putString("context_" + key, value);
    }
    if (!edit.commit()) { call.reject("Experiment context could not be saved"); return; }
    call.resolve();
  }
  @PluginMethod public void report(PluginCall call) {
    String name = call.getString("name", "");
    if (name.matches("game_(open|start|complete)|hint_(used|offer|reward_granted)|save_(error|recovered)|tutorial_(start|end)|first_(pair|unassisted_pair|no_moves|hint|complete)|reminder_(permission_requested|permission|toggle|open)|review_(request|flow)|daily_reward|experiment_assignment|assist_(eligibility|offer|choice|request|result|grant|apply|stored|followup)")) {
      JSObject data = call.getObject("data", new JSObject());
      String id = data.optString("event_id", "");
      if (id.length() > 100) { call.reject("Invalid event id"); return; }
      try {
        synchronized (prefs) {
          JSONArray receipts;
          try { receipts = new JSONArray(prefs.getString("analytics_receipts", "[]")); }
          catch (Exception ignored) { receipts = new JSONArray(); }
          for (int i=0; !id.isEmpty() && i<receipts.length(); i++) {
            if (id.equals(receipts.optString(i))) { call.resolve(new JSObject().put("accepted",true)); return; }
          }
          SeedsApplication.report(getContext(), name, data);
          if (!id.isEmpty()) {
            JSONArray next = new JSONArray();
            for (int i=Math.max(0, receipts.length()-511); i<receipts.length(); i++) next.put(receipts.optString(i));
            next.put(id);
            if (!prefs.edit().putString("analytics_receipts",next.toString()).commit()) {
              call.reject("Event receipt could not be saved"); return;
            }
          }
        }
      } catch (Exception error) { call.reject("Event could not be queued"); return; }
      call.resolve(new JSObject().put("accepted",true)); return;
    }
    call.resolve(new JSObject().put("accepted",false));
  }
  @PluginMethod public void preload(PluginCall call) { getActivity().runOnUiThread(() -> { preloadAds(); publishReadiness(); }); call.resolve(); }
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
      loadingRewarded = true; publishReadiness(); lastRewardedRequest = now; event("ad_request", "rewarded");
      rewardedLoader.loadAd(new AdRequest.Builder(unit("rewarded")).build(), new RewardedAdLoadListener() {
        @Override public void onAdLoaded(@NonNull RewardedAd ad) {
          loadingRewarded = false; if (!destroyed) { rewarded = ad; event("ad_loaded", "rewarded"); publishReadiness(); }
        }
        @Override public void onAdFailedToLoad(@NonNull AdRequestError error) { loadingRewarded = false; event("ad_load_error", "rewarded"); publishReadiness(); }
      });
    }
  }
  @PluginMethod public void show(PluginCall call) { getActivity().runOnUiThread(() -> showOnMain(call)); }
  private void showOnMain(PluginCall call) {
    String kind = call.getString("kind", "");
    if (!kind.equals("rewarded") && !kind.equals("interstitial")) { call.reject("Invalid format"); return; }
    if (destroyed || !resumed || showing != null || !initialized || !enabled()) { call.resolve(new JSObject().put("status", "unavailable").put("reason", rewardedState().optString("reason","unavailable"))); return; }
    long since = System.currentTimeMillis() - prefs.getLong("last_fullscreen", System.currentTimeMillis());
    if (kind.equals("interstitial") && (since < INTERVAL || interstitial == null)) {
      call.resolve(new JSObject().put("status", "skipped").put("reason", since < INTERVAL ? "cooldown" : "not_loaded")); preloadAds(); return;
    }
    if (kind.equals("rewarded") && (rewarded == null || pendingReceipt() || call.getString("attempt", "").isEmpty())) {
      JSObject result = new JSObject().put("status", "unavailable").put("reason", rewardedState().optString("reason","invalid_request")); if (receipt() != null) result.put("reward", receipt());
      call.resolve(result); preloadAds(); return;
    }
    String product = call.getString("product", "hint_pack_3");
    if (kind.equals("rewarded") && !product.matches("hint_pack_3|magnet_1|plan_1")) { call.reject("Unknown reward product"); return; }
    fullscreenActive=true;
    showingProduct = product; showingIntent = call.getString("intent_id", UUID.randomUUID().toString());
    showingOffer = call.getString("offer_id", UUID.randomUUID().toString()); showingSession = call.getString("ad_session_id", UUID.randomUUID().toString());
    showing = call; showingKind = kind; showingAttempt = call.getString("attempt", ""); shown = false; rewardIssued = false; publishReadiness();
    if (bannerHost != null) bannerHost.setVisibility(View.GONE);
    // A missing pre-show callback must not leave the game blocked indefinitely.
    showDeadline = () -> { if (!shown && showing == call) finish("error"); };
    handler.postDelayed(showDeadline, 15000);
    final String adSession = showingSession;
    final String impressionId = UUID.randomUUID().toString();
    try {
      if (kind.equals("interstitial")) {
        interstitial.setAdEventListener(new InterstitialAdEventListener() {
          @Override public void onAdShown() { if (showing == call) didShow(); }
          @Override public void onAdDismissed() { if (showing == call) finish("closed"); }
          @Override public void onAdFailedToShow(@NonNull AdError e) { if (showing == call) finish("error"); }
          @Override public void onAdClicked() { event("ad_clicked", "interstitial"); }
          @Override public void onAdImpression(@Nullable ImpressionData data) { event("ad_impression", "interstitial"); SeedsAdRevenue.report(getContext(),"interstitial",data, impressionId, adSession); }
        });
        interstitial.show(getActivity());
      } else {
        rewarded.setAdEventListener(new RewardedAdEventListener() {
          @Override public void onAdShown() { if (showing == call) didShow(); }
          @Override public void onAdDismissed() { if (showing == call) finish("closed"); }
          @Override public void onAdFailedToShow(@NonNull AdError e) { if (showing == call) finish("error"); }
          @Override public void onAdClicked() { event("ad_clicked", "rewarded"); }
          @Override public void onAdImpression(@Nullable ImpressionData data) { event("ad_impression", "rewarded"); SeedsAdRevenue.report(getContext(),"rewarded",data, impressionId, adSession); }
          @Override public void onRewarded(@NonNull Reward reward) {
            if (showing != call || rewardIssued || pendingReceipt()) return;
            String token = UUID.randomUUID().toString();
            rewardIssued = true;
            heldReceipt = new JSObject().put("version",1).put("token",token).put("attempt",showingAttempt).put("product",showingProduct)
              .put("intent_id",showingIntent).put("offer_id",showingOffer).put("ad_session_id",showingSession);
            receiptNeedsSave = true;
            JSObject earned = receipt();
            if (earned != null) { event("ad_reward_earned", "rewarded"); notifyListeners("reward", earned, true); }
            publishReadiness();
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
    JSObject result = new JSObject().put("shown", shown).put("status", status).put("ad_session_id", showingSession);
    if (showingKind.equals("rewarded") && receipt() != null) result.put("reward", receipt());
    event(status.equals("error") ? "ad_show_error" : "ad_closed", showingKind);
    if (shown) prefs.edit().putLong("last_fullscreen", System.currentTimeMillis()).apply();
    if (showingKind.equals("rewarded")) { if (rewarded != null) rewarded.setAdEventListener(null); rewarded = null; lastRewardedRequest = 0; }
    else { if (interstitial != null) interstitial.setAdEventListener(null); interstitial = null; lastInterstitialRequest = 0; }
    PluginCall call = showing; showing = null; showingAttempt = null; fullscreenActive=false; call.resolve(result);
    preloadAds(); publishReadiness();
  }
  private void clearBanner() {
    if (banner != null) { banner.setBannerAdEventListener(null); banner.destroy(); banner = null; }
    if (bannerHost != null) { if (bannerHost.getParent() instanceof ViewGroup) ((ViewGroup)bannerHost.getParent()).removeView(bannerHost); bannerHost = null; }
    bannerWidth = 0;
    bannerPixelHeight = 0;
  }
  @PluginMethod public void banner(PluginCall call) { getActivity().runOnUiThread(() -> {
    bannerPlacement = new BannerPlacement(call);
    applyBanner(bannerPlacement);
    call.resolve();
  }); }
  private void applyBanner(BannerPlacement placement) {
    if (!initialized || destroyed || !enabled() || showing != null || !resumed || !placement.visible) {
      if (bannerHost != null) bannerHost.setVisibility(View.GONE); return;
    }
    View web = getBridge().getWebView();
    FrameLayout root = getActivity().findViewById(android.R.id.content);
    float scale = web.getWidth() / Math.max(1f, placement.viewportWidth);
    int width = Math.round(placement.width * scale), height = Math.round(placement.height * scale);
    int[] webLocation = new int[2], rootLocation = new int[2]; web.getLocationOnScreen(webLocation); root.getLocationOnScreen(rootLocation);
    int left = webLocation[0] - rootLocation[0] + Math.round(placement.x * scale);
    int top = webLocation[1] - rootLocation[1] + Math.round(placement.y * scale);
    if (width < 1 || height < 1 || left < 0 || left + width > root.getWidth() || top < 0 || top + height > root.getHeight()) { if (bannerHost != null) bannerHost.setVisibility(View.GONE); return; }
    if (banner != null && bannerWidth != width) { clearBanner(); lastBannerRequest = 0; }
    if (banner == null) {
      long now = SystemClock.elapsedRealtime();
      if (lastBannerRequest != 0 && now - lastBannerRequest < RETRY) { return; }
      int dp = Math.max(1, (int) Math.floor(width / getContext().getResources().getDisplayMetrics().density));
      // Request a compact creative from the SDK; never crop a taller sticky ad.
      BannerAdSize size = BannerAdSize.inline(getContext(), dp, 50);
      int requestedHeight = size.getHeightInPixels(getContext());
      publishBannerHeight(requestedHeight, scale);
      if (requestedHeight > height) { return; }
      bannerWidth = width; bannerPixelHeight = requestedHeight; lastBannerRequest = now;
      bannerHost = new FrameLayout(getContext()); root.addView(bannerHost);
      banner = new BannerAdView(getActivity()); banner.setAdSize(size);
      bannerHost.addView(banner, new FrameLayout.LayoutParams(width, bannerPixelHeight, android.view.Gravity.CENTER));
      final BannerAdView currentBanner = banner;
      banner.setBannerAdEventListener(new BannerAdEventListener() {
        @Override public void onAdLoaded() { if (banner != currentBanner) return; if (destroyed) clearBanner(); else event("ad_loaded", "banner"); }
        @Override public void onAdFailedToLoad(@NonNull AdRequestError e) { if (banner != currentBanner) return; event("ad_load_error", "banner"); clearBanner(); /* Retry only on a later action after RETRY. */ }
        @Override public void onAdClicked() { if (banner != currentBanner) return; event("ad_clicked", "banner"); }
        @Override public void onImpression(@Nullable ImpressionData data) { if (banner != currentBanner) return; event("ad_impression", "banner"); SeedsAdRevenue.report(getContext(),"banner",data); }
      });
      event("ad_request", "banner"); banner.loadAd(new AdRequest.Builder(unit("banner")).build());
    }
    if (bannerHost == null) return; // A synchronous load failure may have removed this view.
    publishBannerHeight(bannerPixelHeight, scale);
    if (bannerPixelHeight > height) { bannerHost.setVisibility(View.GONE); return; }
    FrameLayout.LayoutParams layout = new FrameLayout.LayoutParams(width, bannerPixelHeight); layout.leftMargin = left; layout.topMargin = top + height - bannerPixelHeight;
    bannerHost.setLayoutParams(layout); bannerHost.setVisibility(View.VISIBLE);
  }
  private void publishBannerHeight(int pixels, float scale) {
    int cssHeight = (int) Math.ceil(pixels / scale);
    if (cssHeight != bannerCssHeight) {
      bannerCssHeight = cssHeight;
      notifyListeners("bannerSize", new JSObject().put("height", cssHeight), true);
    }
  }
  @Override protected void handleOnConfigurationChanged(Configuration config) { bannerPlacement = null; clearBanner(); bannerCssHeight = 0; lastBannerRequest = 0; }
  @Override protected void handleOnPause() { resumed = false; publishReadiness(); if (bannerHost != null) bannerHost.setVisibility(View.GONE); }
  @Override protected void handleOnResume() { resumed = true; preloadAds(); publishReadiness(); }
  @Override protected void handleOnDestroy() {
    destroyed = true; fullscreenActive=false; handler.removeCallbacksAndMessages(null); clearBanner();
    if (interstitial != null) interstitial.setAdEventListener(null);
    if (rewarded != null) rewarded.setAdEventListener(null);
    if (showing != null) { showing.resolve(new JSObject().put("status", "interrupted")); showing = null; }
  }
}
