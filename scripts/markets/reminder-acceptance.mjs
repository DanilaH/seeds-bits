import fs from 'node:fs';
import assert from 'node:assert/strict';

/** QA only: real receiver, Android permission/channel, alarms and foreground. */
export async function verifyAbsentReminders({adb,profiles,fixture,launch,stop,connect,progress,settings,out}){
  const app='com.seedsbits.game.preview',nativePath=`/data/user/0/${app}/shared_prefs/seeds-engagement.xml`;
  const original=profiles().values, wall=Number(adb('shell','date','+%s')),began=performance.now();
  const autoTime=adb('shell','settings','get','global','auto_time'),autoZone=adb('shell','settings','get','global','auto_time_zone'),zone=adb('shell','getprop','persist.sys.timezone');
  launch();let ui=await connect();const initialPermission=(await ui.evaluate('window.Capacitor.Plugins.SeedsEngagement.configuration()')).granted;ui.close();ui=undefined;stop();
  const rawNative=adb('shell',`if [ -f ${nativePath}.bak ]; then cat ${nativePath}.bak; else cat ${nativePath}; fi`);
  const report={source:process.env.GITHUB_SHA,environment:'Android API35 offline emulator; actual scheduler and receiver',physicalPhone:false,cases:[]};
  const checkpoint=()=>fs.writeFileSync(out+'/absence-reminders.json',JSON.stringify(report,null,2));
  const readNative=()=>adb('shell',`if [ -f ${nativePath}.bak ]; then cat ${nativePath}.bak; else cat ${nativePath}; fi`);
  const escape=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
  function writeNativeXml(xml){
    const path=out+'/reminder-fixture.xml';fs.writeFileSync(path,xml);adb('push',path,'/data/local/tmp/reminder-fixture.xml');
    adb('shell',`run-as ${app} sh -c 'cat /data/local/tmp/reminder-fixture.xml > ${nativePath}'`);adb('shell','rm','-f',nativePath+'.bak');fs.unlinkSync(path);
  }
  function writeNative(fields){writeNativeXml('<?xml version="1.0" encoding="utf-8"?><map>'+Object.entries(fields).map(([k,v])=>`<string name="${k}">${escape(v)}</string>`).join('')+'</map>');}
  const epoch=(date,hour,minute)=>Date.parse(`${date}T${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}:00Z`);
  function clock(date,hour,minute){
    const time=epoch(date,hour,minute);adb('shell','date','-s',`@${time/1000}`);
    assert(Math.abs(Number(adb('shell','date','+%s'))-time/1000)<4,'Android wall-clock fixture must actually apply');
    adb('shell','am','broadcast','-a','android.intent.action.TIME_SET');
  }
  const post=(date,slot,scheduledDate=date)=>{
    const due=epoch(scheduledDate,slot?19:12,slot?0:30);
    adb('shell','am','broadcast','--include-stopped-packages','-n',app+'/.SeedsDailyReminder','-a','seeds.DAILY_REMINDER','--ei','slot',String(slot),'--es','day',scheduledDate,'--el','due',String(due));
  };
  function activeNotifications(){
    const text=adb('shell','dumpsys','notification','--noredact');
    const records=text.split(/Historical notifications|Historical Notifications|Snoozed notifications/i)[0].split('\n').filter(x=>x.includes('NotificationRecord(')&&x.includes('pkg='+app));
    return {text,ids:new Set(records.flatMap(line=>{const m=/\bid=(\d+)\b/.exec(line);return m?[Number(m[1])]:[];}))};
  }
  async function absent(date,hour,minute,{visit='2026-12-04',optOut=false,permission=true,custom='04:10',extra={}}={}){
    stop();clock(date,hour,minute);
    await fixture({[progress]:original[progress],[settings]:{...original[settings],tutorialDone:true,languageChoice:'en',reminders:!optOut,reminderTime:custom}});
    writeNative({last_visit_day:visit,...extra});
    adb('shell','pm',permission?'grant':'revoke',app,'android.permission.POST_NOTIFICATIONS');
  }
  const mark=(name,details={})=>{report.cases.push({name,...details});checkpoint();};
  async function notificationChannel(enabled){
    adb('shell','am','start','-W','-a','android.settings.CHANNEL_NOTIFICATION_SETTINGS','--es','android.provider.extra.APP_PACKAGE',app,'--es','android.provider.extra.CHANNEL_ID','daily-task');
    let xml='';for(let i=0;i<4;i++){
      try{adb('shell','uiautomator','dump','/sdcard/reminder-channel.xml');xml=adb('shell','cat','/sdcard/reminder-channel.xml');if(xml.includes('checked='))break;}catch{}
    }
    fs.writeFileSync(out+`/reminder-channel-${enabled?'enable':'disable'}.xml`,xml);
    const node=[...xml.matchAll(/<node\b[^>]*>/g)].map(x=>x[0]).find(x=>/Switch|CompoundButton/.test(x)&&x.includes('checkable="true"'));
    assert(node,'Actual Android notification channel switch must be found');
    const checked=node.includes('checked="true"');
    if(checked!==enabled){const b=/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/.exec(node);assert(b);adb('shell','input','tap',String((+b[1]+ +b[3])/2),String((+b[2]+ +b[4])/2));}
    launch();ui=await connect();const config=await ui.evaluate('window.Capacitor.Plugins.SeedsEngagement.configuration()');
    assert.equal(config.granted,enabled,'Real channel preference must govern native configuration');ui.close();ui=undefined;stop();
  }
  try{
    adb('shell','settings','put','global','auto_time','0');adb('shell','settings','put','global','auto_time_zone','0');adb('shell','setprop','persist.sys.timezone','Etc/UTC');adb('shell','am','broadcast','-a','android.intent.action.TIMEZONE_CHANGED','--es','time-zone','Etc/UTC');
    await absent('2026-12-05',12,31);post('2026-12-05',0);
    assert(readNative().includes('delivered_slot_0">2026-12-05'));assert(activeNotifications().ids.has(701));
    const lunch=readNative();post('2026-12-05',0);assert.equal(readNative(),lunch);mark('lunch and duplicate receiver',{actualNotification:true});
    clock('2026-12-05',19,1);post('2026-12-05',1);assert(readNative().includes('delivered_slot_1">2026-12-05'));assert(activeNotifications().ids.has(702));mark('evening with no entry',{twoDistinctSlots:true,customTimeIgnored:'04:10'});
    launch();ui=await connect();assert.equal(await ui.evaluate("document.querySelectorAll('#reminder-settings,#result-reminder').length"),0);
    assert(readNative().includes('last_visit_day">2026-12-05'));assert.equal(activeNotifications().ids.size,0);ui.close();ui=undefined;
    adb('shell','input','keyevent','3');post('2026-12-05',1);assert.equal(activeNotifications().ids.size,0);mark('entry after lunch clears posts and suppresses evening');
    for(const [name,hour,minute] of [['before lunch',10,0],['between slots',15,0],['after evening',20,0]]){
      await absent('2026-12-06',hour,minute,{visit:'2026-12-05'});launch();ui=await connect();ui.close();ui=undefined;adb('shell','input','keyevent','3');
      if(hour<19)clock('2026-12-06',19,1);post('2026-12-06',1);assert(!readNative().includes('delivered_slot_1'));mark('any-mode entry '+name);
    }
    for(const [name,options] of [['legacy game opt-out',{optOut:true}],['permission denied',{permission:false}],['permission revoked',{permission:false}]]){
      await absent('2026-12-07',12,31,{visit:'2026-12-06',...options});post('2026-12-07',0);assert(!readNative().includes('delivered_slot_0'));mark(name);
    }
    await absent('2026-12-08',12,31,{visit:'2026-12-07'});launch();ui=await connect();ui.close();ui=undefined;await notificationChannel(false);
    writeNative({last_visit_day:'2026-12-07'});post('2026-12-08',0);assert(!readNative().includes('delivered_slot_0'));mark('actual Android channel disabled');await notificationChannel(true);
    await absent('2026-12-09',15,0,{visit:'2026-12-08'});post('2026-12-09',0);assert(!readNative().includes('delivered_slot_0'));mark('late lunch discarded');
    await absent('2026-12-10',12,31,{visit:'2026-12-09'});post('2026-12-10',0,'2026-12-09');assert(!readNative().includes('delivered_slot_0'));mark('stale scheduled date discarded');
    post('2026-12-10',0);assert(readNative().includes('delivered_slot_0">2026-12-10'));mark('new local day can deliver');
    await absent('2026-12-11',12,31,{visit:'2026-12-10',extra:{last_day:'2026-12-11'}});post('2026-12-11',0);assert(!readNative().includes('delivered_slot_0'));mark('legacy delivery dedup retained');
    await absent('2026-12-12',12,31,{visit:'2026-12-11'});launch();ui=await connect();post('2026-12-12',0);assert(!readNative().includes('delivered_slot_0'));mark('foreground never posts');ui.close();ui=undefined;
    const alarms=adb('shell','dumpsys','alarm');fs.writeFileSync(out+'/absence-alarms.txt',alarms);
    assert(alarms.includes('seeds.DAILY_REMINDER'));assert(alarms.includes(String(epoch('2026-12-13',12,30)))&&alarms.includes(String(epoch('2026-12-13',19,0))),'Both next-day inexact slots must be scheduled after entry');
    mark('actual scheduler has lunch and evening after next midnight',{slots:['12:30','19:00'],inexact:true});
    report.status='PASS';checkpoint();return report;
  }catch(error){report.status='ERROR';report.error=String(error);checkpoint();fs.writeFileSync(out+'/absence-failure-notifications.txt',activeNotifications().text);throw error;}
  finally{
    ui?.close();stop();adb('shell','date','-s',`@${Math.round(wall+(performance.now()-began)/1000)}`);
    adb('shell','setprop','persist.sys.timezone',zone);adb('shell','settings','put','global','auto_time',autoTime);adb('shell','settings','put','global','auto_time_zone',autoZone);
    await fixture(original);writeNativeXml(rawNative);adb('shell','pm',initialPermission?'grant':'revoke',app,'android.permission.POST_NOTIFICATIONS');
    adb('shell','am','broadcast','-a','android.intent.action.TIMEZONE_CHANGED','--es','time-zone',zone);
  }
}
