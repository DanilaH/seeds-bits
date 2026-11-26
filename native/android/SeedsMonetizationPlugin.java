package com.seedsbits.game.preview;

import android.content.SharedPreferences;
import android.content.res.Configuration;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.view.View;
import android.view.ViewGroup;
import android.view.ViewTreeObserver;
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
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@CapacitorPlugin(name = "SeedsMonetization")
public class SeedsMonetizationPlugin extends Plugin {
  static volatile boolean fullscreenActive;
  private static final long INTERVAL = 180000L, RETRY = 60000L;
  private final Handler handler = new Handler(Looper.getMainLooper());
  private SharedPreferences prefs;
  private boolean initialized, destroyed, resumed = true, loadingInterstitial, loadingRewarded;
  private boolean initializationWaitExpired, rewardedWaitExpired;
  private long lastInterstitialRequest, lastRewardedRequest, lastBannerRequest;
  private InterstitialAdLoader interstitialLoader;
  private RewardedAdLoader rewardedLoader;
  private InterstitialAd interstitial;
  private RewardedAd rewarded;
  private BannerAdView banner;
  private FrameLayout bannerHost;
  private int bannerWidth, bannerWidthDp;
  private int bannerPixelHeight;
  private int bannerCssHeight, bannerLeft = -1, bannerTop = -1;
  private long bannerRevision;
  private String bannerEpoch = "";
  private int measuredWebWidth, measuredWebHeight;
  private int placedRootWidth, placedRootHeight, placedWebWidth;
  private boolean bannerExpected;
  private int bannerRequests, bannerLoads, bannerImpressions, bannerFrames, bannerHiddenFrames;
  private String bannerHiddenReason = "not_requested";
  private final java.util.Map<String,Integer> bannerHiddenReasons = new java.util.HashMap<>();
  private String showingRoute = "", showingTransition = "";
  private final ViewTreeObserver.OnWindowFocusChangeListener bannerFocus = this::windowFocusChanged;
  private final View.OnLayoutChangeListener bannerLayout = (view, left, top, right, bottom, oldLeft, oldTop, oldRight, oldBottom) -> {
    if (right-left != oldRight-oldLeft || bottom-top != oldBottom-oldTop) {
      deferBannerGeometry("native_state");
      requestBannerRefresh();
    }
  };
  private final ViewTreeObserver.OnPreDrawListener bannerProbe = () -> {
    if (bannerExpected) {
      bannerFrames++;
      if (bannerHost == null || bannerHost.getVisibility() != View.VISIBLE) {
        bannerHiddenFrames++;
        bannerHiddenReasons.put(bannerHiddenReason,bannerHiddenReasons.getOrDefault(bannerHiddenReason,0)+1);
      }
    }
    return true;
  };
  private PluginCall showing;
  private String showingKind, showingProduct, showingIntent, showingOffer, showingSession;
  private boolean shown;
  private final List<JSObject> earnedReceipts = new ArrayList<>();
  private boolean receiptsNeedSave;
  private String reportedReceipt = "";
  private RewardClaim showingReward;

  private static final class RewardClaim {
    final JSObject receipt;
    boolean issued, failed;
    RewardClaim(String attempt, String product, String intent, String offer, String session) {
      receipt = new JSObject().put("version",1).put("token",UUID.randomUUID().toString())
        .put("attempt",attempt).put("product",product).put("intent_id",intent)
        .put("offer_id",offer).put("ad_session_id",session);
    }
  }
  private BannerPlacement bannerPlacement;
  private static double number(PluginCall call, String key) {
    Object value = call.getData().opt(key);
    return value instanceof Number ? ((Number)value).doubleValue() : Double.NaN;
  }
  private static final class BannerPlacement {
    final boolean visible;
    final double x, y, width, height, viewportWidth, viewportHeight, pixelRatio;
    BannerPlacement(PluginCall call) {
      visible = call.getBoolean("visible", false);
      x = number(call, "x"); y = number(call, "y");
      width = number(call, "width"); height = number(call, "height");
      viewportWidth = number(call, "viewportWidth"); viewportHeight = number(call, "viewportHeight");
      pixelRatio = number(call, "pixelRatio");
    }
    boolean valid() {
      return Double.isFinite(x) && Double.isFinite(y) && Double.isFinite(width) && Double.isFinite(height)
        && Double.isFinite(viewportWidth) && Double.isFinite(viewportHeight)
        && x >= 0 && y >= 0 && width > 0 && height > 0 && viewportWidth > 0 && viewportHeight > 0
        && x + width <= viewportWidth + 0.001 && y + height <= viewportHeight + 0.001;
    }
  }
  private Runnable showDeadline;

  @Override public void load() {
    fullscreenActive=false;
    prefs = getContext().getSharedPreferences("seeds-monetization", 0);
    if (!prefs.contains("last_fullscreen")) prefs.edit().putLong("last_fullscreen", System.currentTimeMillis()).apply();
    handler.postDelayed(() -> { if (!initialized && !destroyed) { initializationWaitExpired=true; publishReadiness(); } },18000);
    getActivity().runOnUiThread(() -> {
      View web = getBridge().getWebView();
      web.addOnLayoutChangeListener(bannerLayout);
      ViewTreeObserver observer = web.getViewTreeObserver();
      observer.addOnWindowFocusChangeListener(bannerFocus);
      if (demoAds()) observer.addOnPreDrawListener(bannerProbe);
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
  private boolean demoAds() { return getContext().getResources().getBoolean(R.bool.ads_test_mode); }
  private String unit(String kind) {
    if (demoAds()) return "demo-" + kind + "-yandex";
    return getContext().getString(kind.equals("banner") ? R.string.yandex_banner_id : kind.equals("rewarded") ? R.string.yandex_rewarded_id : R.string.yandex_interstitial_id);
  }
  private void event(String name, String kind) {
    try {
      JSObject data = new JSObject().put("format", kind);
      if (showing != null && kind.equals(showingKind)) data.put("ad_session_id",showingSession).put("product",showingProduct).put("intent_id",showingIntent).put("offer_id",showingOffer).put("route",showingRoute).put("transition_id",showingTransition);
      SeedsApplication.report(getContext(), name, data);
    }
    catch (Exception ignored) { /* Optional telemetry cannot interrupt an ad callback. */ }
  }
  private static final String[] RECEIPT_FIELDS = {"token", "attempt", "version", "product", "intent", "offer", "session"};
  private static final String[] WIRE_FIELDS = {"token", "attempt", "version", "product", "intent_id", "offer_id", "ad_session_id"};

  private int storedTailCount() {
    return (int) prefs.getLong("reward_tail_count", 0);
  }
  private static String receiptPrefix(int index) {
    return index == 0 ? "reward_" : "reward_tail_" + index + "_";
  }
  private void loadReceipts() {
    if (!earnedReceipts.isEmpty() || receiptsNeedSave) return;
    for (int index = 0; index <= storedTailCount(); index++) {
      String prefix = receiptPrefix(index);
      if (prefs.getString(prefix + "token", "").isEmpty()) continue;
      JSObject entry = new JSObject();
      for (int i = 0; i < RECEIPT_FIELDS.length; i++) {
        String key = prefix + RECEIPT_FIELDS[i];
        if (!prefs.contains(key)) continue;
        String value = prefs.getString(key, "");
        if (WIRE_FIELDS[i].equals("version")) {
          try { entry.put("version", Integer.parseInt(value)); }
          catch (NumberFormatException ignored) { entry.put("version", 0); }
        } else entry.put(WIRE_FIELDS[i], value);
      }
      earnedReceipts.add(entry);
    }
    // A failed commit can leave an unconfirmed update in the in-process preferences.
    receiptsNeedSave = !earnedReceipts.isEmpty();
  }
  private boolean persistReceipts(List<JSObject> receipts) {
    SharedPreferences.Editor edit = prefs.edit();
    for (int index = 0; index < Math.max(storedTailCount() + 1, receipts.size()); index++) {
      String prefix = receiptPrefix(index);
      JSObject value = index < receipts.size() ? receipts.get(index) : null;
      for (int i = 0; i < RECEIPT_FIELDS.length; i++) {
        String key = prefix + RECEIPT_FIELDS[i];
        if (value == null || value.optString(WIRE_FIELDS[i],"").isEmpty()) edit.remove(key);
        else edit.putString(key,value.optString(WIRE_FIELDS[i],""));
      }
    }
    return edit.putLong("reward_tail_count", Math.max(0, receipts.size() - 1)).commit();
  }
  private JSObject receipt() {
    loadReceipts();
    return receiptsNeedSave || earnedReceipts.isEmpty() ? null : earnedReceipts.get(0);
  }
  private boolean pendingReceipt() { loadReceipts(); return !earnedReceipts.isEmpty(); }
  private void recoverReceipt() {
    loadReceipts();
    if (receiptsNeedSave) {
      if (!persistReceipts(earnedReceipts)) return;
      receiptsNeedSave = false;
    }
    JSObject next = receipt();
    if (destroyed || next == null || reportedReceipt.equals(next.optString("token",""))) return;
    reportedReceipt = next.optString("token","");
    try { SeedsApplication.report(getContext(),"ad_reward_earned",new JSObject()
      .put("event_id",reportedReceipt+":earned").put("format","rewarded")
      .put("product",next.optString("product","hint_pack_3")).put("receipt",reportedReceipt)
      .put("intent_id",next.optString("intent_id","legacy")).put("offer_id",next.optString("offer_id","legacy"))
      .put("ad_session_id",next.optString("ad_session_id","legacy"))); } catch (Exception ignored) {}
    notifyListeners("reward",next,true);
  }
  private void acceptReward(RewardClaim claim) {
    if (claim.issued || claim.failed) return;
    claim.issued = true;
    loadReceipts();
    earnedReceipts.add(claim.receipt);
    receiptsNeedSave = true;
    recoverReceipt();
    publishReadiness();
  }
  private JSObject rewardedState() {
    String state = "unavailable", reason = "not_loaded";
    if (destroyed || !enabled()) { state = "disabled"; reason = "disabled"; }
    else if (pendingReceipt()) reason = "pending_receipt";
    else if (!resumed) reason = "background";
    else if (showing != null) reason = "fullscreen_busy";
    else if ((loadingRewarded && !rewardedWaitExpired) || (!initialized && !initializationWaitExpired)) { state = "loading"; reason = "loading"; }
    else if ((!initialized && initializationWaitExpired) || (loadingRewarded && rewardedWaitExpired)) reason = "load_timeout";
    else if (rewarded != null) { state = "ready"; reason = "ready"; }
    return new JSObject().put("state", state).put("reason", reason);
  }
  private void publishReadiness() { notifyListeners("rewardedState", rewardedState(), true); }
  @PluginMethod public void readiness(PluginCall call) { getActivity().runOnUiThread(() -> call.resolve(rewardedState())); }
  @PluginMethod public void initialize(PluginCall call) { getActivity().runOnUiThread(() -> {
    recoverReceipt();
    bannerEpoch = UUID.randomUUID().toString();
    bannerRevision = 0;
    JSObject result = new JSObject().put("enabled", enabled()).put("test", demoAds())
      .put("bannerEpoch",bannerEpoch).put("bannerHeight",bannerCssHeight);
    JSObject reward = receipt(); if (reward != null) result.put("reward", reward);
    result.put("readiness", rewardedState()); call.resolve(result);
  }); }
  @PluginMethod public void pending(PluginCall call) { getActivity().runOnUiThread(() -> {
    recoverReceipt();
    JSObject result = new JSObject(); JSObject reward = receipt(); if (reward != null) result.put("reward", reward); call.resolve(result);
  }); }
  @PluginMethod public void acknowledge(PluginCall call) { getActivity().runOnUiThread(() -> {
    recoverReceipt();
    JSObject reward = receipt();
    if (reward != null && call.getString("token", "").equals(reward.optString("token", ""))) {
      List<JSObject> remaining = new ArrayList<>(earnedReceipts.subList(1,earnedReceipts.size()));
      if (!persistReceipts(remaining)) {
        receiptsNeedSave = true; call.reject("Reward acknowledgement could not be saved"); return;
      }
      earnedReceipts.remove(0);
      recoverReceipt();
    } else if (receiptsNeedSave) { call.reject("Pending reward is not durable"); return; }
    publishReadiness(); call.resolve();
  }); }
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

  @PluginMethod public void persistLabState(PluginCall call) {
    String key=call.getString("key","");
    if(!key.equals("seeds-bits.lab.trials.v1")&&!key.equals("seeds-bits.lab.shuffle.v1")){call.reject("Invalid lab key");return;}
    SharedPreferences storage=getContext().getSharedPreferences("CapacitorStorage",0);
    String previous=storage.getString(key,null);
    if(!storage.edit().putString(key,call.getString("value","")).commit()){
      SharedPreferences.Editor rollback=storage.edit();
      if(previous==null)rollback.remove(key);else rollback.putString(key,previous);
      rollback.commit();call.reject("Lab state could not be saved","DISK_COMMIT");return;
    }
    call.resolve();
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
  @PluginMethod public void installContext(PluginCall call) {
    JSObject data = SeedsInstallStore.capture(getContext());
    data.put("build_channel", getContext().getString(R.string.analytics_channel));
    data.put("enabled", !getContext().getString(R.string.appmetrica_api_key).isEmpty());
    android.os.LocaleList current = getContext().getResources().getConfiguration().getLocales();
    JSONArray locales = new JSONArray();
    for (int i=0; i<current.size() && i<12; i++) locales.put(current.get(i).toLanguageTag());
    data.put("locales", locales);
    call.resolve(data);
  }
  @PluginMethod public void report(PluginCall call) {
    String name = call.getString("name", "");
    if (name.matches("game_(open|start|complete)|hint_(used|offer|reward_granted)|save_(error|recovered)|tutorial_(start|end)|first_(pair|unassisted_pair|no_moves|hint|complete)|reminder_(permission_requested|permission|toggle|open)|review_(request|flow)|daily_reward|result_transition|experiment_assignment|distribution_context|language_picker_open|language_changed|locale_resolved|activity_day|assist_(eligibility|offer|choice|request|result|grant|apply|stored|followup)")) {
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
      loadingRewarded = true; rewardedWaitExpired=false;
      // End the UI wait without starting a parallel SDK load. A late loaded
      // callback may make a later explicit tap ready, never auto-show a video.
      handler.postDelayed(() -> { if (loadingRewarded && !destroyed) { rewardedWaitExpired=true; publishReadiness(); } },18000);
      publishReadiness(); lastRewardedRequest = now; event("ad_request", "rewarded");
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
    if (destroyed || !resumed || !getActivity().hasWindowFocus() || showing != null || !initialized || !enabled()) { call.resolve(new JSObject().put("status", "unavailable").put("reason", rewardedState().optString("reason","unavailable"))); return; }
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
    showingRoute = call.getString("route", "");
    showingTransition = call.getString("transition_id", "");
    showingProduct = product; showingIntent = call.getString("intent_id", UUID.randomUUID().toString());
    showingOffer = call.getString("offer_id", UUID.randomUUID().toString()); showingSession = call.getString("ad_session_id", UUID.randomUUID().toString());
    showing = call; showingKind = kind; shown = false;
    final RewardClaim claim = kind.equals("rewarded")
      ? new RewardClaim(call.getString("attempt",""), product, showingIntent, showingOffer, showingSession)
      : null;
    showingReward = claim;
    publishReadiness();
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
          @Override public void onAdClicked() { if (showing == call) event("ad_clicked", "interstitial"); }
          @Override public void onAdImpression(@Nullable ImpressionData data) { if (showing == call) event("ad_impression", "interstitial"); SeedsAdRevenue.report(getContext(),"interstitial",data, impressionId, adSession); }
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
            // SDK dismissal can precede this callback. The listener still owns its original claim.
            getActivity().runOnUiThread(() -> acceptReward(claim));
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
    recoverReceipt();
    JSObject result = new JSObject().put("shown", shown).put("status", status).put("ad_session_id", showingSession);
    if (showingReward != null) {
      if (status.equals("error") && !shown) showingReward.failed = true;
      JSObject pending = receipt();
      if (pending != null && pending.optString("token","").equals(showingReward.receipt.optString("token","")))
        result.put("reward", pending);
      else if (showingReward.issued && receiptsNeedSave)
        result.put("status","reward_pending").put("reason","receipt_save");
    }
    event(status.equals("error") ? "ad_show_error" : "ad_closed", showingKind);
    if (shown) prefs.edit().putLong("last_fullscreen", System.currentTimeMillis()).apply();
    if (showingKind.equals("rewarded")) {
      if (showingReward.failed && rewarded != null) rewarded.setAdEventListener(null);
      rewarded = null; lastRewardedRequest = 0;
    }
    else { if (interstitial != null) interstitial.setAdEventListener(null); interstitial = null; lastInterstitialRequest = 0; }
    PluginCall call = showing; showing = null; showingReward = null; fullscreenActive=false; call.resolve(result);
    if (bannerPlacement != null) applyBanner(bannerPlacement);
    preloadAds(); publishReadiness();
  }
  private void windowFocusChanged(boolean focused) {
    if (!focused) hideBanner("window_focus");
    // Only the SDK can dismiss a shown fullscreen. Focus alone can return under its overlay.
    else if (showing == null && bannerPlacement != null) applyBanner(bannerPlacement);
  }
  private boolean canPlaceBanner() {
    return initialized && !destroyed && enabled() && !fullscreenActive && resumed && getActivity().hasWindowFocus();
  }
  private void hideBanner(String reason) {
    bannerHiddenReason = reason;
    if (bannerHost != null) bannerHost.setVisibility(View.GONE);
  }
  private void deferBannerGeometry(String reason) {
    FrameLayout root = getActivity().findViewById(android.R.id.content);
    // SystemBars can briefly remove/reapply WebView insets during uiMode changes.
    // Keep the last validated SDK placement while the physical window/width stay
    // unchanged. Real resize, modal intent and lifecycle still hide immediately.
    if (canPlaceBanner() && bannerPlacement != null && bannerPlacement.visible &&
        bannerHost != null && bannerHost.getVisibility() == View.VISIBLE && root != null &&
        root.getWidth() == placedRootWidth && root.getHeight() == placedRootHeight &&
        getBridge().getWebView().getWidth() == placedWebWidth) return;
    hideBanner(reason);
  }
  private void clearBanner() {
    if (banner != null) { banner.setBannerAdEventListener(null); banner.destroy(); banner = null; }
    if (bannerHost != null) { if (bannerHost.getParent() instanceof ViewGroup) ((ViewGroup)bannerHost.getParent()).removeView(bannerHost); bannerHost = null; }
    bannerWidth = 0;
    bannerPixelHeight = 0;
    bannerLeft = bannerTop = -1;
  }
  @PluginMethod public void banner(PluginCall call) { getActivity().runOnUiThread(() -> {
    double revision = number(call, "revision");
    if (bannerEpoch.equals(call.getString("epoch", "")) &&
        Double.isFinite(revision) && revision == Math.rint(revision) &&
        revision > bannerRevision && revision <= 9007199254740991d) {
      bannerRevision = (long)revision;
      bannerPlacement = new BannerPlacement(call);
      measuredWebWidth = getBridge().getWebView().getWidth();
      measuredWebHeight = getBridge().getWebView().getHeight();
      applyBanner(bannerPlacement);
    }
    call.resolve();
  }); }
  @PluginMethod public void bannerExpectation(PluginCall call) { getActivity().runOnUiThread(() -> {
    if (demoAds()) bannerExpected = call.getBoolean("visible",false);
    call.resolve();
  }); }
  @PluginMethod public void bannerDiagnostics(PluginCall call) { getActivity().runOnUiThread(() -> {
    if (!demoAds()) { call.resolve(new JSObject()); return; }
    View web = getBridge().getWebView();
    int[] webLocation = new int[2], bannerLocation = new int[2];
    web.getLocationOnScreen(webLocation);
    if (bannerHost != null) bannerHost.getLocationOnScreen(bannerLocation);
    JSObject hiddenReasons = new JSObject();
    for (var entry : bannerHiddenReasons.entrySet()) hiddenReasons.put(entry.getKey(),entry.getValue());
    call.resolve(new JSObject()
      .put("measuredRevision",bannerRevision).put("request",bannerRequests)
      .put("view",banner==null?0:System.identityHashCode(banner))
      .put("loaded",bannerLoads).put("impressions",bannerImpressions)
      .put("visible",bannerHost!=null&&bannerHost.getVisibility()==View.VISIBLE)
      .put("hiddenReason",bannerHiddenReason)
      .put("hiddenReasons",hiddenReasons)
      .put("expected",bannerExpected).put("requestedVisible",bannerPlacement!=null&&bannerPlacement.visible)
      .put("fullscreen",fullscreenActive).put("resumed",resumed)
      .put("focused",getActivity().hasWindowFocus())
      .put("frames",bannerFrames).put("hiddenFrames",bannerHiddenFrames)
      .put("width",bannerWidth).put("height",bannerPixelHeight)
      .put("left",bannerLeft).put("top",bannerTop)
      .put("screenLeft",bannerLocation[0]).put("screenTop",bannerLocation[1])
      .put("webX",webLocation[0]).put("webY",webLocation[1])
      .put("webWidth",web.getWidth()).put("webHeight",web.getHeight()));
  }); }
  private void applyBanner(BannerPlacement placement) {
    if (!canPlaceBanner()) { hideBanner("native_lifecycle"); return; }
    if (!placement.visible) { hideBanner("web_requested_hidden"); return; }
    if (!placement.valid()) { hideBanner("invalid_placement"); return; }
    View web = getBridge().getWebView();
    FrameLayout root = getActivity().findViewById(android.R.id.content);
    if (web.getWidth() <= 0 || web.getHeight() <= 0 || root == null ||
        web.getWidth() != measuredWebWidth || web.getHeight() != measuredWebHeight) { deferBannerGeometry("native_bounds_changed"); return; }
    // Native bounds can resize before CSS reports its new viewport. Keep the SDK view
    // until both measurements refer to the same width, with one CSS pixel of rounding.
    if (Double.isFinite(placement.pixelRatio) && placement.pixelRatio > 0 &&
        Math.abs(web.getWidth() - placement.viewportWidth * placement.pixelRatio) > Math.max(1, placement.pixelRatio)) {
      hideBanner("scale_mismatch");
      return;
    }
    double scale = web.getWidth() / placement.viewportWidth;
    if (Math.abs(web.getHeight() - placement.viewportHeight * scale) > Math.max(1, scale)) {
      deferBannerGeometry("height_mismatch");
      return;
    }
    int[] webLocation = new int[2], rootLocation = new int[2];
    web.getLocationOnScreen(webLocation); root.getLocationOnScreen(rootLocation);
    int offsetX = webLocation[0] - rootLocation[0], offsetY = webLocation[1] - rootLocation[1];
    int left = offsetX + (int)Math.ceil(placement.x * scale - 1e-6);
    int top = offsetY + (int)Math.ceil(placement.y * scale - 1e-6);
    int right = offsetX + (int)Math.floor((placement.x + placement.width) * scale + 1e-6);
    int bottom = offsetY + (int)Math.floor((placement.y + placement.height) * scale + 1e-6);
    int width = right - left, height = bottom - top;
    if (width < 1 || height < 1 || left < Math.max(offsetX, root.getPaddingLeft())
        || top < Math.max(offsetY, root.getPaddingTop())
        || right > Math.min(offsetX + web.getWidth(), root.getWidth() - root.getPaddingRight())
        || bottom > Math.min(offsetY + web.getHeight(), root.getHeight() - root.getPaddingBottom())) {
      hideBanner("outside_bounds");
      return;
    }
    int dp = Math.max(1, (int) Math.floor(width / getContext().getResources().getDisplayMetrics().density));
    if (banner != null && (bannerWidth != width || bannerWidthDp != dp)) { clearBanner(); lastBannerRequest = 0; }
    if (banner == null) {
      long now = SystemClock.elapsedRealtime();
      if (lastBannerRequest != 0 && now - lastBannerRequest < RETRY) { return; }
      // Request a compact creative from the SDK; never crop a taller sticky ad.
      BannerAdSize size = BannerAdSize.inline(getContext(), dp, 50);
      int requestedHeight = size.getHeightInPixels(getContext());
      if (requestedHeight > height) { publishBannerHeight(requestedHeight + (height == requestedHeight - 1 ? 1 : 0), scale, true); return; }
      publishBannerHeight(requestedHeight, scale, false);
      bannerWidth = width; bannerWidthDp = dp; bannerPixelHeight = requestedHeight; lastBannerRequest = now;
      bannerHost = new FrameLayout(getContext()); bannerHost.setVisibility(View.GONE); root.addView(bannerHost);
      banner = new BannerAdView(getActivity()); banner.setAdSize(size);
      bannerHost.addView(banner, new FrameLayout.LayoutParams(width, bannerPixelHeight, android.view.Gravity.CENTER));
      final BannerAdView currentBanner = banner;
      banner.setBannerAdEventListener(new BannerAdEventListener() {
        @Override public void onAdLoaded() { if (banner != currentBanner) return; if (destroyed) clearBanner(); else { bannerLoads++; event("ad_loaded", "banner"); } }
        @Override public void onAdFailedToLoad(@NonNull AdRequestError e) { if (banner != currentBanner) return; event("ad_load_error", "banner"); clearBanner(); /* Retry only on a later action after RETRY. */ }
        @Override public void onAdClicked() { if (banner != currentBanner) return; event("ad_clicked", "banner"); }
        @Override public void onImpression(@Nullable ImpressionData data) { if (banner != currentBanner) return; bannerImpressions++; event("ad_impression", "banner"); SeedsAdRevenue.report(getContext(),"banner",data); }
      });
      bannerRequests++; event("ad_request", "banner"); banner.loadAd(new AdRequest.Builder(unit("banner")).build());
    }
    if (bannerHost == null) return; // A synchronous load failure may have removed this view.
    if (bannerPixelHeight > height) { publishBannerHeight(bannerPixelHeight + (height == bannerPixelHeight - 1 ? 1 : 0), scale, true); hideBanner("creative_height"); return; }
    int parentLeft = left - root.getPaddingLeft();
    int parentTop = bottom - bannerPixelHeight - root.getPaddingTop();
    if (bannerLeft != parentLeft || bannerTop != parentTop) {
      FrameLayout.LayoutParams layout = new FrameLayout.LayoutParams(width, bannerPixelHeight);
      layout.leftMargin = parentLeft;
      layout.topMargin = parentTop;
      bannerHost.setLayoutParams(layout);
      bannerLeft = parentLeft;
      bannerTop = parentTop;
    }
    if (bannerHost.getVisibility() != View.VISIBLE) bannerHost.setVisibility(View.VISIBLE);
    placedRootWidth = root.getWidth(); placedRootHeight = root.getHeight(); placedWebWidth = web.getWidth();
    bannerHiddenReason = "";
  }
  private void publishBannerHeight(int pixels, double scale, boolean grow) {
    int cssHeight = (int) Math.ceil(pixels / scale);
    if (!grow && bannerCssHeight == cssHeight + 1) return;
    if (cssHeight != bannerCssHeight) {
      bannerCssHeight = cssHeight;
      notifyListeners("bannerSize", new JSObject().put("height", cssHeight), true);
    }
  }
  private void requestBannerRefresh() { notifyListeners("bannerRefresh",new JSObject(),false); }
  @Override protected void handleOnConfigurationChanged(Configuration config) { requestBannerRefresh(); }
  @Override protected void handleOnPause() { resumed = false; windowFocusChanged(false); publishReadiness(); }
  @Override protected void handleOnResume() { resumed = true; recoverReceipt(); preloadAds(); publishReadiness(); }
  @Override protected void handleOnDestroy() {
    destroyed = true; fullscreenActive=false; handler.removeCallbacksAndMessages(null); clearBanner();
    ViewTreeObserver observer = getBridge().getWebView().getViewTreeObserver();
    if (observer.isAlive()) {
      observer.removeOnWindowFocusChangeListener(bannerFocus);
      observer.removeOnPreDrawListener(bannerProbe);
    }
    getBridge().getWebView().removeOnLayoutChangeListener(bannerLayout);
    if (interstitial != null) interstitial.setAdEventListener(null);
    if (rewarded != null && (showingReward == null || showingReward.failed)) rewarded.setAdEventListener(null);
    if (showing != null) { showing.resolve(new JSObject().put("status", "interrupted")); showing = null; }
  }
}
