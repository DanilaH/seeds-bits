package com.seedsbits.game.preview;

import android.content.Context;
import android.media.AudioAttributes;
import android.os.Build;
import android.os.SystemClock;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Adapted Road Lines recipe; local profiles, monotonic cancellation barrier, no delayed pulse queue. */
@CapacitorPlugin(name="SeedsFeedback")
public class SeedsFeedbackPlugin extends Plugin {
  private boolean foreground=true, enabled=false;
  private long epoch=-1, lastPulse=-1000, protectedUntil=0;
  private int lastPriority;
  private Vibrator vibrator(){
    if(Build.VERSION.SDK_INT>=31){VibratorManager m=(VibratorManager)getContext().getSystemService(Context.VIBRATOR_MANAGER_SERVICE);return m==null?null:m.getDefaultVibrator();}
    return (Vibrator)getContext().getSystemService(Context.VIBRATOR_SERVICE);
  }
  private void stop(){protectedUntil=0;try{Vibrator v=vibrator();if(v!=null)v.cancel();}catch(RuntimeException ignored){}}
  @PluginMethod public synchronized void configure(PluginCall call){
    Long revision=call.getLong("epoch");
    if(revision!=null && revision>epoch){epoch=revision;enabled=call.getBoolean("enabled",false);lastPulse=-1000;lastPriority=0;stop();}
    call.resolve();
  }
  @PluginMethod public synchronized void pulse(PluginCall call){
    Long revision=call.getLong("epoch"), issued=call.getLong("issuedAt");
    if(revision==null||revision!=epoch||issued==null||Math.abs(System.currentTimeMillis()-issued)>350||!foreground||!enabled){call.resolve();return;}
    String cue=call.getString("cue","button");
    int priority="win".equals(cue)?4:"full".equals(cue)?3:("pair".equals(cue)||"undo".equals(cue)||"hint".equals(cue)||"reject".equals(cue))?2:"land".equals(cue)?0:1;
    long now=SystemClock.uptimeMillis(), gap="land".equals(cue)?90:70;
    if((now<protectedUntil && priority<3)||(now-lastPulse<gap && !(priority>lastPriority&&(priority>=3||now-lastPulse>=18)))){call.resolve();return;}
    Vibrator v=vibrator();if(v==null||!v.hasVibrator()){call.resolve();return;}
    lastPulse=now;lastPriority=priority;
    AudioAttributes attributes=new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ASSISTANCE_SONIFICATION).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build();
    try {
      long[] timings=null;int[] amplitudes=null;
      if("win".equals(cue)){timings=new long[]{0,34,45,42,55,62};amplitudes=new int[]{0,235,0,250,0,255};protectedUntil=now+300;}
      else if("full".equals(cue)){timings=new long[]{0,26,64,30,46,18};amplitudes=new int[]{0,220,0,250,0,170};protectedUntil=now+240;}
      else if("undo".equals(cue)){timings=new long[]{0,14,22,20};amplitudes=new int[]{0,160,0,230};}
      else if("hint".equals(cue)){timings=new long[]{0,16,20,18};amplitudes=new int[]{0,180,0,220};}
      else if("reject".equals(cue)){timings=new long[]{0,18,24,18};amplitudes=new int[]{0,180,0,190};}
      if(timings!=null){
        if(Build.VERSION.SDK_INT>=26&&v.hasAmplitudeControl())v.vibrate(VibrationEffect.createWaveform(timings,amplitudes,-1),attributes);
        else if(Build.VERSION.SDK_INT>=26)v.vibrate(VibrationEffect.createWaveform(timings,-1),attributes);
        else v.vibrate(timings,-1,attributes);
      }else{
        int duration="select".equals(cue)||"pair".equals(cue)?24:"land".equals(cue)?10:14;
        int amplitude="pair".equals(cue)?230:"select".equals(cue)?200:"land".equals(cue)?140:160;
        if(Build.VERSION.SDK_INT>=26)v.vibrate(VibrationEffect.createOneShot(duration,v.hasAmplitudeControl()?amplitude:VibrationEffect.DEFAULT_AMPLITUDE),attributes);
        else v.vibrate(duration,attributes);
      }
    }catch(RuntimeException ignored){/* Missing device support must not interrupt the puzzle. */}
    call.resolve();
  }
  @Override protected synchronized void handleOnPause(){foreground=false;enabled=false;epoch++;stop();}
  @Override protected synchronized void handleOnResume(){foreground=true;}
  @Override protected synchronized void handleOnDestroy(){foreground=false;enabled=false;epoch++;stop();}
}
