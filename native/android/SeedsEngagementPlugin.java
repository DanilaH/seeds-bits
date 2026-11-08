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

@CapacitorPlugin(name="SeedsEngagement",permissions={@Permission(alias="notifications",strings={Manifest.permission.POST_NOTIFICATIONS})})
public class SeedsEngagementPlugin extends Plugin {
  static volatile boolean foreground;
  private boolean reviewing;
  private final Handler handler=new Handler(Looper.getMainLooper());
  private PluginCall reviewCall;
  private int reviewGeneration;
  @Override public void load() {foreground=true;SeedsDailyReminder.sync(getContext());}
  private boolean consumeEntry(Intent intent) {
    boolean entry=intent!=null && intent.getBooleanExtra("seeds_daily_notification",false);
    if(entry)intent.removeExtra("seeds_daily_notification");
    return entry;
  }
  @PluginMethod public void configuration(PluginCall call) {
    call.resolve(new JSObject().put("available",true).put("granted",SeedsDailyReminder.allowed(getContext())).put("entry",consumeEntry(getActivity().getIntent())));
  }
  @PluginMethod public void requestNotifications(PluginCall call) {
    if(Build.VERSION.SDK_INT>=33 && getPermissionState("notifications")!=PermissionState.GRANTED) requestPermissionForAlias("notifications",call,"notificationPermission");
    else notificationPermission(call);
  }
  @PermissionCallback private void notificationPermission(PluginCall call) {
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
  @PluginMethod public void review(PluginCall call) {
    getActivity().runOnUiThread(()->{
      if(reviewing || !foreground || getActivity().isFinishing()){call.resolve(new JSObject().put("status","unavailable"));return;}
      reviewing=true;reviewCall=call;final int generation=++reviewGeneration;
      final boolean[] launched={false};
      handler.postDelayed(()->{if(generation==reviewGeneration && reviewing && !launched[0])finishReview("prepare_timeout");},10000);
      try {
        RuStoreReviewManager manager=RuStoreReviewManagerFactory.INSTANCE.create(getContext());
        manager.requestReviewFlow().addOnSuccessListener(info->getActivity().runOnUiThread(()->{
          if(generation!=reviewGeneration || !reviewing)return;
          if(!foreground){finishReview("backgrounded");return;}
          launched[0]=true;
          try {
            manager.launchReviewFlow(info)
              .addOnSuccessListener(unit->finishReview("finished"))
              .addOnFailureListener(error->finishReview(reviewError(error)));
          }catch(Exception error){finishReview(reviewError(error));}
        })).addOnFailureListener(error->{if(generation==reviewGeneration)finishReview(reviewError(error));});
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
    reviewing=false;reviewGeneration++;
    PluginCall call=reviewCall;reviewCall=null;
    if(call!=null)call.resolve(new JSObject().put("status",status));
  }
}
