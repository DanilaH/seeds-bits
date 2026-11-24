package com.seedsbits.game.preview;

import android.app.*;
import android.content.*;
import android.os.Build;
import android.os.LocaleList;
import android.icu.text.PluralRules;
import java.io.InputStream;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import org.json.*;
import java.text.SimpleDateFormat;
import java.util.*;

/** Local, inexact reminder, enabled by default; explicit opt-out and Android permission apply. No service, network request, or exact-alarm permission. */
public class SeedsDailyReminder extends BroadcastReceiver {
  private static final String CHANNEL="daily-task",ACTION="seeds.DAILY_REMINDER";
  private static final int ID=701;
  static SharedPreferences storage(Context c){return c.getSharedPreferences("CapacitorStorage",0);}
  static SharedPreferences prefs(Context c){return c.getSharedPreferences("seeds-engagement",0);}
  private static JSONObject json(String raw){try{return new JSONObject(raw);}catch(Exception e){return new JSONObject();}}
  private static JSONObject progress(Context c){return json(storage(c).getString("seeds-bits.progress.v2","{}"));}
  private static JSONObject settings(Context c){return json(storage(c).getString("seeds-bits.settings.v1","{}"));}
  private static String day(long time){return new SimpleDateFormat("yyyy-MM-dd",Locale.US).format(new Date(time));}
  private static long utcDay(String day) throws Exception {
    SimpleDateFormat format=new SimpleDateFormat("yyyy-MM-dd",Locale.US);format.setLenient(false);format.setTimeZone(TimeZone.getTimeZone("UTC"));
    if(!day.matches("\\d{4}-\\d{2}-\\d{2}"))throw new Exception("date");
    return format.parse(day).getTime()/86400000L;
  }
  private static NotificationManager manager(Context c){return (NotificationManager)c.getSystemService(Context.NOTIFICATION_SERVICE);}
  private static JSONObject catalog;
  private static synchronized JSONObject catalog(Context context) {
    if (catalog != null) return catalog;
    try (InputStream input = context.getResources().openRawResource(R.raw.seeds_notification_copy);
        ByteArrayOutputStream content = new ByteArrayOutputStream()) {
      byte[] chunk = new byte[1024];
      for (int size; (size=input.read(chunk))!=-1;) content.write(chunk,0,size);
      catalog = new JSONObject(new String(content.toByteArray(), StandardCharsets.UTF_8));
      return catalog;
    } catch(Exception ignored) { return new JSONObject(); }
  }
  private static String language(Context context, JSONObject table) {
    String selected = settings(context).optString("languageChoice","auto");
    if (table.has(selected)) return selected;
    LocaleList system = context.getResources().getConfiguration().getLocales();
    for (int i=0; i<system.size(); i++) {
      String base = system.get(i).getLanguage();
      String key = "pt".equals(base) ? "pt-BR" : base;
      if (table.has(key)) return key;
    }
    return "en";
  }
  private static JSONObject copy(Context context) {
    JSONObject table = catalog(context);
    JSONObject value = table.optJSONObject(language(context, table));
    return value == null ? new JSONObject() : value;
  }
  private static void channel(Context c){
    if(Build.VERSION.SDK_INT>=26){
      JSONObject strings = copy(c);
      NotificationChannel channel=new NotificationChannel(CHANNEL,strings.optString("channel","Daily puzzle"),NotificationManager.IMPORTANCE_LOW);
      channel.setDescription(strings.optString("channelDescription","A reminder for today’s puzzle"));channel.enableVibration(false);channel.setSound(null,null);
      manager(c).createNotificationChannel(channel);
    }
  }
  static boolean allowed(Context c){
    if(!manager(c).areNotificationsEnabled())return false;
    if(Build.VERSION.SDK_INT>=26){NotificationChannel channel=manager(c).getNotificationChannel(CHANNEL);if(channel!=null && channel.getImportance()==NotificationManager.IMPORTANCE_NONE)return false;}
    return true;
  }
  private static PendingIntent alarmIntent(Context c){
    return PendingIntent.getBroadcast(c,ID,new Intent(c,SeedsDailyReminder.class).setAction(ACTION),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
  }
  static boolean done(JSONObject p,String day){
    JSONArray done=p.optJSONArray("done");if(done==null)return false;
    String id="daily-v1-"+day;for(int i=0;i<done.length();i++)if(id.equals(done.optString(i)) || ("daily-v3-"+day).equals(done.optString(i)) || ("daily-v4-"+day).equals(done.optString(i)) || ("daily-v5-"+day).equals(done.optString(i)))return true;
    return false;
  }
  public static void sync(Context c){
    try {
      channel(c);JSONObject s=settings(c);
      AlarmManager alarms=(AlarmManager)c.getSystemService(Context.ALARM_SERVICE);
      if(!s.optBoolean("reminders",true) || !allowed(c)){alarms.cancel(alarmIntent(c));manager(c).cancel(ID);return;}
      long now=System.currentTimeMillis();String today=day(now);
      if(done(progress(c),today))manager(c).cancel(ID);
      String time=s.optString("reminderTime","12:30");if(!time.matches("([01]\\d|2[0-3]):[0-5]\\d"))time="12:30";
      String[] fields=time.split(":");Calendar next=Calendar.getInstance();next.set(Calendar.HOUR_OF_DAY,Integer.parseInt(fields[0]));next.set(Calendar.MINUTE,Integer.parseInt(fields[1]));next.set(Calendar.SECOND,0);next.set(Calendar.MILLISECOND,0);
      if(next.getTimeInMillis()<=now)next.add(Calendar.DAY_OF_YEAR,1);
      alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,next.getTimeInMillis(),alarmIntent(c));
    }catch(Exception ignored){/* A reminder must never turn a successful game save into failure. */}
  }
  @Override public void onReceive(Context c,Intent intent){
    if(ACTION.equals(intent.getAction()))deliver(c);
    // Clock/timezone changes must not leave a notification with an old personalised promise.
    else if(Intent.ACTION_TIME_CHANGED.equals(intent.getAction()) || Intent.ACTION_TIMEZONE_CHANGED.equals(intent.getAction()))manager(c).cancel(ID);
    sync(c);
  }
  private static void deliver(Context c){
    try {
      JSONObject s=settings(c),p=progress(c);long now=System.currentTimeMillis();String today=day(now);
      SharedPreferences preferences=prefs(c);
      if(!s.optBoolean("reminders",true)||!allowed(c)||SeedsEngagementPlugin.foreground||SeedsEngagementPlugin.externalWindow||SeedsMonetizationPlugin.fullscreenActive||done(p,today)||today.compareTo(preferences.getString("last_day",""))<=0)return;
      String configured=s.optString("reminderTime","12:30");if(!configured.matches("([01]\\d|2[0-3]):[0-5]\\d"))configured="12:30";
      Calendar clock=Calendar.getInstance();int hour=clock.get(Calendar.HOUR_OF_DAY);
      Calendar due=(Calendar)clock.clone();String[] at=configured.split(":");due.set(Calendar.HOUR_OF_DAY,Integer.parseInt(at[0]));due.set(Calendar.MINUTE,Integer.parseInt(at[1]));due.set(Calendar.SECOND,0);due.set(Calendar.MILLISECOND,0);
      // Honour the chosen time, but discard a message delayed beyond its useful window.
      long delay=now-due.getTimeInMillis();if(delay<0||delay>2*60*60*1000L)return;
      JSONObject run=p.optJSONObject("meta")==null?null:p.optJSONObject("meta").optJSONObject("daily");
      int next=1;
      if(run!=null && utcDay(today)-utcDay(run.optString("lastDay"))==1)next=run.optInt("count",0)+1;
      int reward=next==3?1:next>0&&next%7==0?3:0;
      JSONObject sessions=p.optJSONObject("sessions"), assignments=p.optJSONObject("dailyAssignments");
      JSONObject game=null;
      if(sessions!=null){
        String assigned=assignments==null?"":assignments.optString(today,"");
        if(assigned.matches("daily-v[1345]-"+today))game=sessions.optJSONObject(assigned);
        else for(int version:new int[]{1,3,4,5}){
          game=sessions.optJSONObject("daily-v"+version+"-"+today);
          if(game!=null)break;
        }
      }
      boolean started=game!=null && game.optJSONObject("current")!=null && game.optJSONObject("current").optInt("moves",0)>0;
      JSONObject table=catalog(c);
      JSONObject text=copy(c);
      String title=text.optString("channel","Daily puzzle");
      List<String[]> pool=new ArrayList<>();
      if(reward>0 && next>1) {
        JSONObject forms=text.optJSONObject("milestone");
        String category=PluralRules.forLocale(Locale.forLanguageTag(language(c,table))).select(reward);
        String body=forms.optString(category,forms.optString("other"))
            .replace("{days}",String.valueOf(next)).replace("{reward}",String.valueOf(reward));
        pool.add(new String[]{"milestone",title,body});
      } else if(started) {
        pool.add(new String[]{"resume",title,text.optString("resume")});
        pool.add(new String[]{"return",title,text.optString("return")});
      } else {
        pool.add(new String[]{"new",title,text.optString("new")});
        pool.add(new String[]{"break",text.optString("breakTitle",title),text.optString("break")});
        pool.add(new String[]{"calendar",text.optString("calendarTitle",title),text.optString("calendar")});
        pool.add(new String[]{"pause",text.optString("pauseTitle",title),text.optString("pause")});
        if(hour>=11&&hour<15)pool.add(new String[]{"lunch",text.optString("breakTitle",title),text.optString("lunch")});
        Calendar yesterday=Calendar.getInstance();yesterday.add(Calendar.DAY_OF_YEAR,-1);
        if(done(p,day(yesterday.getTimeInMillis())))pool.add(new String[]{"yesterday",title,text.optString("yesterday")});
      }
      String history=preferences.getString("text_history","");List<String[]> candidates=new ArrayList<>();
      for(String[] item:pool)if(!Arrays.asList(history.split(",")).contains(item[0]))candidates.add(item);
      if(candidates.isEmpty())candidates=pool;
      String[] chosen=candidates.get(new Random().nextInt(candidates.size()));
      List<String> recent=new ArrayList<>();recent.add(chosen[0]);for(String id:history.split(","))if(!id.isEmpty()&&!id.equals(chosen[0])&&recent.size()<3)recent.add(id);
      if(!preferences.edit().putString("last_day",today).putString("text_history",android.text.TextUtils.join(",",recent)).commit())return;
      Intent open=new Intent(c,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP|Intent.FLAG_ACTIVITY_CLEAR_TOP).putExtra("seeds_daily_notification",true);
      PendingIntent tap=PendingIntent.getActivity(c,ID,open,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
      Notification.Builder builder=Build.VERSION.SDK_INT>=26?new Notification.Builder(c,CHANNEL):new Notification.Builder(c);
      builder.setSmallIcon(R.drawable.ic_seed_notification).setContentTitle(chosen[1]).setContentText(chosen[2]).setStyle(new Notification.BigTextStyle().bigText(chosen[2])).setContentIntent(tap).setAutoCancel(true).setOnlyAlertOnce(true);
      if(Build.VERSION.SDK_INT>=26){Calendar expiry=Calendar.getInstance();expiry.add(Calendar.DAY_OF_YEAR,1);expiry.set(Calendar.HOUR_OF_DAY,0);expiry.set(Calendar.MINUTE,0);expiry.set(Calendar.SECOND,0);builder.setTimeoutAfter(Math.max(1,expiry.getTimeInMillis()-now));}
      manager(c).notify(ID,builder.build());
    }catch(Exception ignored){}
  }
}
