package com.seedsbits.game.preview;

import android.Manifest;
import android.content.Intent;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import ru.rustore.sdk.review.RuStoreReviewManager;
import ru.rustore.sdk.review.RuStoreReviewManagerFactory;
import ru.rustore.sdk.review.model.ReviewInfo;

@CapacitorPlugin(name="SeedsEngagement",permissions={@Permission(alias="notifications",strings={Manifest.permission.POST_NOTIFICATIONS})})
public class SeedsEngagementPlugin extends Plugin {
  static volatile boolean foreground, externalWindow;
  private volatile boolean reviewing;
  private final Handler handler=new Handler(Looper.getMainLooper());
  private PluginCall reviewCall;
  private volatile int reviewGeneration;
  private RuStoreReviewManager manager;
  private volatile ReviewInfo prepared;
  private long preparedAt;
  @Override public void load() {foreground=true;SeedsDailyReminder.sync(getContext());}
  private boolean consumeEntry(Intent intent) {
    boolean entry=intent!=null && intent.getBooleanExtra("seeds_daily_notification",false);
    if(entry)intent.removeExtra("seeds_daily_notification");
    return entry;
  }
  @PluginMethod public void configuration(PluginCall call) {
    call.resolve(new JSObject().put("available",true).put("granted",SeedsDailyReminder.allowed(getContext())).put("entry",consumeEntry(getActivity().getIntent())));
  }
  @PluginMethod public void openNotificationSettings(PluginCall call) {
    getActivity().runOnUiThread(()->{
      try {
        Intent intent;
        if(Build.VERSION.SDK_INT>=26)intent=new Intent(android.provider.Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(android.provider.Settings.EXTRA_APP_PACKAGE,getContext().getPackageName());
        else intent=new Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS,android.net.Uri.parse("package:"+getContext().getPackageName()));
        getActivity().startActivity(intent);call.resolve();
      }catch(Exception error){call.reject("Notification settings unavailable");}
    });
  }
  @PluginMethod public void requestNotifications(PluginCall call) {
    android.util.Log.i("SeedsNotifications", "request_entered");
    getActivity().runOnUiThread(()->{
      try {
        android.util.Log.i("SeedsNotifications", "request_on_main: " + getPermissionState("notifications"));
        if(getPermissionState("notifications")==null) {
          call.reject("Notification permission alias unavailable", "NOTIFICATION_PERMISSION");return;
        }
        if(getActivity().isFinishing() || getActivity().isDestroyed()) {
          call.reject("Activity unavailable", "NOTIFICATION_ACTIVITY");return;
        }
        if(Build.VERSION.SDK_INT>=33 && getPermissionState("notifications")!=PermissionState.GRANTED)
          requestPermissionForAlias("notifications",call,"notificationPermission");
        else notificationPermission(call);
      }catch(Exception error){android.util.Log.w("SeedsNotifications", "request_error: " + error.getClass().getSimpleName());call.reject("Notification request unavailable", "NOTIFICATION_REQUEST", error);}
    });
  }
  @PermissionCallback private void notificationPermission(PluginCall call) {
    android.util.Log.i("SeedsNotifications", "permission_callback");
    call.resolve(new JSObject().put("available",true).put("granted",SeedsDailyReminder.allowed(getContext())));
  }
  @Override protected void handleOnNewIntent(Intent intent) {
    if(consumeEntry(intent))notifyListeners("dailyOpen",new JSObject(),true);
  }
  @Override protected void handleOnResume() {foreground=true;SeedsDailyReminder.sync(getContext());}
  @Override protected void handleOnPause() {foreground=false;}
  @Override protected void handleOnDestroy() {
    foreground=false;
    finishReview("destroyed");handler.removeCallbacksAndMessages(null);
  }
  @PluginMethod public void prepareReview(PluginCall call) {
    getActivity().runOnUiThread(()->{
      if(reviewing || !foreground || getActivity().isFinishing()){call.resolve(new JSObject().put("status","unavailable"));return;}
      reviewing=true;reviewCall=call;final int generation=++reviewGeneration;
      handler.postDelayed(()->{if(generation==reviewGeneration && reviewing)finishReview("prepare_timeout");},10000);
      try {
        manager=RuStoreReviewManagerFactory.INSTANCE.create(getContext());
        manager.requestReviewFlow().addOnSuccessListener(info->{
          if(generation!=reviewGeneration || !reviewing)return;
          if(!foreground){finishReview("backgrounded");return;}
          preparedAt=android.os.SystemClock.elapsedRealtime();prepared=info;finishReview("ready");
        }).addOnFailureListener(error->{if(generation==reviewGeneration)finishReview(reviewError(error));});
      }catch(Exception error){finishReview(reviewError(error));}
    });
  }
  @PluginMethod public void review(PluginCall call) {
    getActivity().runOnUiThread(()->{
      if(reviewing || !foreground || prepared==null || android.os.SystemClock.elapsedRealtime()-preparedAt>=300000 || getActivity().isFinishing()){call.resolve(new JSObject().put("status","unavailable"));return;}
      reviewing=true;externalWindow=true;reviewCall=call;ReviewInfo info=prepared;prepared=null;
      try {
        manager.launchReviewFlow(info).addOnSuccessListener(unit->finishReview("finished")).addOnFailureListener(error->finishReview(reviewError(error)));
      }catch(Exception error){finishReview(reviewError(error));}
    });
  }
  private String reviewError(Throwable error) {
    String name=error.getClass().getSimpleName();
    if(name.equals("RuStoreReviewExists"))return "exists";
    if(name.equals("RuStoreRequestLimitReached"))return "limited";
    if(name.equals("RuStoreNotInstalledException"))return "not_installed";
    if(name.equals("RuStoreUserUnauthorizedException"))return "unauthorized";
    if(name.equals("RuStoreOutdatedException"))return "outdated";
    return "sdk_error";
  }
  private synchronized void finishReview(String status) {
    if(!reviewing)return;
    reviewing=false;externalWindow=false;reviewGeneration++;
    PluginCall call=reviewCall;reviewCall=null;
    if(call!=null)call.resolve(new JSObject().put("status",status));
  }
}
