"""Compile the production feedback bridge against deterministic Android/Capacitor doubles.
Checks cancellation/priority/API fallbacks, not a physical motor or Android SDK behaviour.
"""
from pathlib import Path
import json,subprocess,tempfile,shutil
with tempfile.TemporaryDirectory(prefix='seeds-feedback-') as folder:
 root=Path(folder)
 def put(name,code):
  p=root/'src'/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(code)
 put('android/content/Context.java','''package android.content;import android.os.*;public class Context {public static String VIBRATOR_SERVICE="v",VIBRATOR_MANAGER_SERVICE="vm";public Vibrator v=new Vibrator();public Object getSystemService(String key){return key.equals("vm")?new VibratorManager(v):v;}}''')
 put('android/media/AudioAttributes.java','''package android.media;public class AudioAttributes {public static int USAGE_ASSISTANCE_SONIFICATION=1,CONTENT_TYPE_SONIFICATION=2;public static class Builder{public Builder setUsage(int a){return this;}public Builder setContentType(int a){return this;}public AudioAttributes build(){return new AudioAttributes();}}}''')
 put('android/os/Build.java','package android.os;public class Build{public static class VERSION {public static int SDK_INT=35;}}')
 put('android/os/SystemClock.java','package android.os;public class SystemClock {public static long now=10000;public static long uptimeMillis(){return now;}}')
 put('android/os/VibrationEffect.java','''package android.os;public class VibrationEffect {public static int DEFAULT_AMPLITUDE=-1;public long[] timing;public int[] amp;public long duration;public int amplitude;public static VibrationEffect createWaveform(long[]t,int[]a,int r){VibrationEffect e=new VibrationEffect();e.timing=t;e.amp=a;return e;}public static VibrationEffect createWaveform(long[]t,int r){return createWaveform(t,null,r);}public static VibrationEffect createOneShot(long d,int a){VibrationEffect e=new VibrationEffect();e.duration=d;e.amplitude=a;return e;}}''')
 put('android/os/Vibrator.java','''package android.os;import android.media.AudioAttributes;public class Vibrator {public boolean motor=true,amp=true,fail=false;public int pulses=0,cancels=0;public VibrationEffect last;public long[] legacy;public boolean hasVibrator(){return motor;}public boolean hasAmplitudeControl(){return amp;}public void cancel(){cancels++;if(fail)throw new RuntimeException();}public void vibrate(VibrationEffect e,AudioAttributes a){if(fail)throw new RuntimeException();pulses++;last=e;}public void vibrate(long[]t,int r,AudioAttributes a){pulses++;legacy=t;}public void vibrate(long t,AudioAttributes a){pulses++;legacy=new long[]{t};}}''')
 put('android/os/VibratorManager.java','package android.os;public class VibratorManager{private Vibrator v;public VibratorManager(Vibrator x){v=x;}public Vibrator getDefaultVibrator(){return v;}}')
 put('com/getcapacitor/Plugin.java','package com.getcapacitor;import android.content.Context;public class Plugin{public Context context=new Context();public Context getContext(){return context;}protected void handleOnPause(){}protected void handleOnResume(){}protected void handleOnDestroy(){}}')
 put('com/getcapacitor/PluginMethod.java','package com.getcapacitor;public @interface PluginMethod{}')
 put('com/getcapacitor/annotation/CapacitorPlugin.java','package com.getcapacitor.annotation;public @interface CapacitorPlugin{String name();}')
 put('com/getcapacitor/PluginCall.java','''package com.getcapacitor;import java.util.*;public class PluginCall{public Map<String,Object> args=new HashMap<>();public boolean resolved;public Long getLong(String k){return (Long)args.get(k);}public String getString(String k,String d){return (String)args.getOrDefault(k,d);}public Boolean getBoolean(String k,boolean d){return (Boolean)args.getOrDefault(k,d);}public void resolve(){resolved=true;}public PluginCall value(String k,Object v){args.put(k,v);return this;}}''')
 put('com/seedsbits/game/preview/SeedsFeedbackPlugin.java',Path('native/android/SeedsFeedbackPlugin.java').read_text())
 put('com/seedsbits/game/preview/FeedbackHarness.java','''package com.seedsbits.game.preview;
import android.os.*;import com.getcapacitor.*;
public class FeedbackHarness {
 static void check(String name,boolean ok){System.out.println(name+"|"+ok);if(!ok)throw new AssertionError(name);}
 static void config(SeedsFeedbackPlugin p,long epoch,boolean on){p.configure(new PluginCall().value("epoch",epoch).value("enabled",on));}
 static PluginCall pulse(SeedsFeedbackPlugin p,long epoch,String cue){PluginCall c=new PluginCall().value("epoch",epoch).value("issuedAt",System.currentTimeMillis()).value("cue",cue);p.pulse(c);return c;}
 public static void main(String[]args){
  SeedsFeedbackPlugin p=new SeedsFeedbackPlugin();Vibrator v=p.context.v;
  pulse(p,1,"pair");check("F01_off_before_configuration",v.pulses==0);
  config(p,1,true);pulse(p,1,"button");check("F02_api31_manager_contact",v.pulses==1&&v.last.duration>0);
  p.pulse(new PluginCall().value("epoch",1L).value("issuedAt",System.currentTimeMillis()-1000).value("cue","win"));check("F03_stale_pulse_dropped",v.pulses==1);
  config(p,2,false);pulse(p,1,"win");config(p,1,true);pulse(p,2,"win");check("F04_cancel_reorder_cannot_restart_motor",v.pulses==1&&v.cancels>=2);
  config(p,3,true);SystemClock.now+=100;pulse(p,3,"pair");check("F05_explicit_new_epoch_works",v.pulses==2);
  p.handleOnPause();p.handleOnResume();SystemClock.now+=100;pulse(p,3,"win");check("F06_pause_is_native_generation_barrier",v.pulses==2);
  config(p,5,true);pulse(p,5,"win");int n=v.pulses;SystemClock.now+=80;pulse(p,5,"button");check("F07_win_protects_its_pattern",v.pulses==n);
  SystemClock.now+=250;pulse(p,5,"pair");check("F08_new_contact_after_win",v.pulses==n+1);
  config(p,6,true);pulse(p,6,"select");n=v.pulses;SystemClock.now+=20;pulse(p,6,"pair");check("F09_pair_can_replace_selection",v.pulses==n+1);
  config(p,7,true);pulse(p,7,"button");n=v.pulses;SystemClock.now+=20;pulse(p,7,"button");check("F10_rapid_low_priority_has_no_queue",v.pulses==n);
  config(p,8,true);v.motor=false;SystemClock.now+=100;pulse(p,8,"pair");check("F11_no_motor_is_optional",v.pulses==n);v.motor=true;
  Build.VERSION.SDK_INT=26;v.amp=false;config(p,9,true);pulse(p,9,"undo");check("F12_waveform_without_amplitude_control",v.last.timing!=null&&v.last.amp==null);
  config(p,10,true);pulse(p,10,"pair");check("F13_one_shot_default_amplitude_fallback",v.last.amplitude==VibrationEffect.DEFAULT_AMPLITUDE);
  Build.VERSION.SDK_INT=24;config(p,11,true);pulse(p,11,"win");check("F14_api24_waveform",v.legacy!=null&&v.legacy.length>2);
  Build.VERSION.SDK_INT=35;config(p,12,true);v.fail=true;PluginCall c=pulse(p,12,"pair");config(p,13,false);check("F15_motor_failure_does_not_break_game",c.resolved);v.fail=false;
  config(p,14,true);p.handleOnDestroy();p.handleOnResume();n=v.pulses;SystemClock.now+=500;pulse(p,14,"win");check("F16_destroy_drops_late_callbacks",v.pulses==n);
 }
}''')
 files=[str(p)for p in (root/'src').rglob('*.java')]
 compiler=['javac'] if shutil.which('javac') else ['java','-m','jdk.compiler/com.sun.tools.javac.Main']
 subprocess.run([*compiler,'-d',str(root/'classes'),*files],check=True)
 r=subprocess.run(['java','-cp',str(root/'classes'),'com.seedsbits.game.preview.FeedbackHarness'],check=True,capture_output=True,text=True)
 results=[{'case':line.split('|')[0],'passed':line.split('|')[1]=='true'}for line in r.stdout.splitlines()]
 out=Path('test-results/feedback-native.json');out.parent.mkdir(parents=True,exist_ok=True)
 out.write_text(json.dumps({'method':'Production native feedback bridge with Android/Capacitor doubles, no physical motor inference','results':results},indent=2)+'\n')
 print(json.dumps(results,indent=2));assert all(x['passed']for x in results)
