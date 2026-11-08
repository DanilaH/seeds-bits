package com.seedsbits.game.preview;

import android.app.*;
import android.content.*;
import android.os.Build;
import org.json.*;
import java.text.SimpleDateFormat;
import java.util.*;
import io.appmetrica.analytics.AppMetrica;

/** Local, inexact, opt-in reminder. No service, network request, or exact-alarm permission. */
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
  private static void channel(Context c){
    if(Build.VERSION.SDK_INT>=26){
      NotificationChannel channel=new NotificationChannel(CHANNEL,"Задача дня",NotificationManager.IMPORTANCE_LOW);
      channel.setDescription("Добровольное напоминание о сегодняшней головоломке");channel.enableVibration(false);channel.setSound(null,null);
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
    String id="daily-v1-"+day;for(int i=0;i<done.length();i++)if(id.equals(done.optString(i)))return true;
    return false;
  }
  public static void sync(Context c){
    try {
      channel(c);JSONObject s=settings(c);
      AlarmManager alarms=(AlarmManager)c.getSystemService(Context.ALARM_SERVICE);
      if(!s.optBoolean("reminders",false) || !allowed(c)){alarms.cancel(alarmIntent(c));manager(c).cancel(ID);return;}
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
      if(!s.optBoolean("reminders",false)||!allowed(c)||SeedsEngagementPlugin.foreground||done(p,today)||today.equals(preferences.getString("last_day","")))return;
      String configured=s.optString("reminderTime","12:30");if(!configured.matches("([01]\\d|2[0-3]):[0-5]\\d"))configured="12:30";
      Calendar clock=Calendar.getInstance();int hour=clock.get(Calendar.HOUR_OF_DAY);
      Calendar due=(Calendar)clock.clone();String[] at=configured.split(":");due.set(Calendar.HOUR_OF_DAY,Integer.parseInt(at[0]));due.set(Calendar.MINUTE,Integer.parseInt(at[1]));due.set(Calendar.SECOND,0);due.set(Calendar.MILLISECOND,0);
      // Honour the chosen time, but discard a message delayed beyond its useful window.
      long delay=now-due.getTimeInMillis();if(delay<0||delay>2*60*60*1000L)return;
      JSONObject run=p.optJSONObject("meta")==null?null:p.optJSONObject("meta").optJSONObject("daily");
      int next=1;
      if(run!=null && utcDay(today)-utcDay(run.optString("lastDay"))==1)next=run.optInt("count",0)+1;
      int reward=next==3?1:next>0&&next%7==0?3:0;
      JSONObject game=p.optJSONObject("sessions")==null?null:p.optJSONObject("sessions").optJSONObject("daily-v1-"+today);
      boolean started=game!=null && game.optJSONObject("current")!=null && game.optJSONObject("current").optInt("moves",0)>0;
      List<String[]> pool=new ArrayList<>();
      if(reward>0 && next>1)pool.add(new String[]{"milestone","Задача дня","Сегодня может быть "+next+"-й день подряд. За прохождение — "+reward+(reward==1?" подсказка.":" подсказки.")});
      else if(started){pool.add(new String[]{"resume","Задача дня","Продолжим сегодняшнюю задачу?"});pool.add(new String[]{"return","Задача дня","Можно вернуться к начатой головоломке."});}
      else {
        pool.add(new String[]{"new","Задача дня","Есть новая задачка на сегодня."});
        pool.add(new String[]{"break","Перерыв на семечки?","Сегодняшняя головоломка готова."});
        pool.add(new String[]{"calendar","Что там сегодня?","В календаре появилась новая задача."});
        pool.add(new String[]{"pause","Можно немного отвлечься","Открыть сегодняшнюю головоломку?"});
        if(hour>=11&&hour<15)pool.add(new String[]{"lunch","Перерыв на семечки?","Обеденный перерыв? Есть задачка с числами."});
        Calendar yesterday=Calendar.getInstance();yesterday.add(Calendar.DAY_OF_YEAR,-1);
        if(done(p,day(yesterday.getTimeInMillis())))pool.add(new String[]{"yesterday","Задача дня","Вчерашняя решена. Сегодня — новая."});
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
      if(!c.getString(R.string.appmetrica_api_key).isEmpty())AppMetrica.reportEvent("reminder_posted",new JSONObject().put("template",chosen[0]).put("test",c.getResources().getBoolean(R.bool.ads_test_mode)).toString());
    }catch(Exception ignored){}
  }
}
