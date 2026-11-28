import fs from 'node:fs';
import assert from 'node:assert/strict';
// QA driver only. No test fault or fixture is bundled into the application.
export async function verifyFunctionalAudit({adb,profiles,fixture,launch,stop,connect,progress,settings,out,candidate,prior12108,prior12109,prior12110,prior12111,prior12112,prefs}) {
 const initial=profiles().values, report={source:process.env.GITHUB_SHA,physicalPhone:false,environment:'Android API35 offline emulator',recovery:[],profiles:[],permissions:[],timezones:[]};
 const checkpoint=()=>{fs.writeFileSync(out+'/functional-audit.json',JSON.stringify(report,null,2));console.log('FUNCTIONAL_AUDIT_CHECKPOINT',JSON.stringify({status:report.status??'RUNNING',recovery:report.recovery.length,profiles:report.profiles.map(p=>p.years),upgrade:!!report.upgrade12108,permissions:report.permissions.length,timezones:report.timezones.length,reboot:!!report.reboot}));};
 let ui;
 try {
  const puzzle=JSON.parse(fs.readFileSync('src/notebook.json','utf8'))[4],id=puzzle.id;
  for(let trial=0;trial<3;trial++){
   const data={version:3,active:id,done:[],seen:[],hints:{},sessions:{[id]:{rules:1,current:{board:puzzle.board,moves:0,scroll:0,additions:0},history:[]}},meta:{version:2,wallet:9,since:'2026-11-01',completed:0,unassisted:0,attempts:{[id]:{id:'native-recovery-'+trial,completed:false}},rewardReceipts:['prior-reward']}};
   await fixture({[progress]:data,[settings]:{tutorialDone:true,languageChoice:'en',sound:false,vibration:false}});launch();ui=await connect();await ui.tap('#resume');
   for(const [a,b] of [[3,4],[5,13],[6,15],[2,11]]){await ui.tap(`#board [data-index="${a}"]`);await ui.tap(`#board [data-index="${b}"]`);}
   await ui.until("document.querySelector('.game').dataset.persistence==='saved' && document.querySelector('#remaining').textContent==='4'");
   await ui.tap('#hint');await ui.until("document.querySelector('#no-moves-primary').textContent==='Undo 2 moves'");
   await ui.evaluate(`(()=>{const original=window.Capacitor.nativePromise;window.releaseRecovery=undefined;window.Capacitor.nativePromise=function(plugin,method,options){if(plugin==='SeedsMonetization'&&method==='persistState'&&!window.recoveryHeld&&JSON.parse(options.value).sessions[${JSON.stringify(id)}]?.current.moves===2){window.recoveryHeld=true;return new Promise(resolve=>{window.releaseRecovery=()=>resolve(original.call(this,plugin,method,options));});}return original.call(this,plugin,method,options);};return true;})()`);
   await ui.tap('#no-moves-primary');await ui.until("document.querySelector('.game').dataset.persistence==='pending' && document.querySelector('#remaining').textContent==='8' && !!window.releaseRecovery");
   assert.equal(profiles().values[progress].sessions[id].current.moves,4);
   await ui.evaluate('window.releaseRecovery();true');await ui.until("document.querySelector('.game').dataset.persistence==='saved'");
   // No post-ack sleep or disk polling before process death.
   stop();ui.close();ui=undefined;
   const saved=profiles().values[progress];assert.equal(saved.sessions[id].current.moves,2);assert.equal(saved.sessions[id].packedHistory.length,2);assert.equal(saved.meta.wallet,9);assert.deepEqual(saved.meta.rewardReceipts,['prior-reward']);
   launch();ui=await connect();await ui.tap('#resume');assert.equal(await ui.evaluate("document.querySelector('#remaining').textContent"),'8');ui.close();ui=undefined;stop();
   report.recovery.push({trial,heldDiskMoves:4,pendingTruthful:true,forceStopImmediatelyAfterSaved:true,reloadedMoves:2,remaining:8,history:2,wallet:9});checkpoint();
  }
  for(const years of [1,3,5]){
   const raw=fs.readFileSync(`test-results/functional-profiles/archive-${years}.json`,'utf8'),data=JSON.parse(raw),beforeSeeds=data.jars.meter;
   await fixture({[progress]:data,[settings]:{tutorialDone:true,languageChoice:'en',sound:false,vibration:false,reminders:true,reminderTime:'12:30'}});
   const boot=performance.now();launch();ui=await connect();await ui.tap('#resume');
   const coldBootToFieldMs=performance.now()-boot;
   adb('shell','dumpsys','gfxinfo','com.seedsbits.game.preview','reset');
   await ui.evaluate(`(()=>{window.frameGaps=[];window.recordFrames=true;let last;function frame(now){if(!window.recordFrames)return;if(last!==undefined&&!document.hidden)window.frameGaps.push(now-last);last=now;requestAnimationFrame(frame);}requestAnimationFrame(frame);window.nativeWrites=[];const original=window.Capacitor.nativePromise;window.Capacitor.nativePromise=function(plugin,method,options){const start=performance.now(),p=original.call(this,plugin,method,options);return plugin==='SeedsMonetization'&&method==='persistState'?p.then(value=>{window.nativeWrites.push(performance.now()-start);return value;}):p;};return true;})()`);
   const memoryBefore=adb('shell','dumpsys','meminfo','-s','com.seedsbits.game.preview');
   for(let sample=0;sample<10;sample++){
    const cells=await ui.evaluate("[...document.querySelectorAll('#board [data-index]')].filter(e=>!e.disabled&&e.textContent.trim()).slice(0,2).map(e=>e.dataset.index)");assert.equal(cells.length,2);
    await ui.tap(`#board [data-index="${cells[0]}"]`);await ui.tap(`#board [data-index="${cells[1]}"]`);await ui.until("document.querySelector('.game').dataset.persistence==='saved'");
    await ui.tap('#undo');await ui.until("document.querySelector('.game').dataset.persistence==='saved'");
   }
   const times=await ui.evaluate('window.nativeWrites'),sorted=[...times].sort((a,b)=>a-b);
   assert(times.length>=20,'Every measured move/Undo needs a native commit sample');
   const gaps=await ui.evaluate('window.recordFrames=false;window.frameGaps'),ordered=[...gaps].sort((a,b)=>a-b);
   const frames={scope:"Visible document rAF gaps during moves/Undo; emulator software GPU",samples:gaps.length,p50:ordered[Math.ceil(ordered.length*.5)-1],p95:ordered[Math.ceil(ordered.length*.95)-1],over50ms:gaps.filter(g=>g>50).length,maxGapMs:ordered.at(-1)};
   const gfxinfo=adb('shell','dumpsys','gfxinfo','com.seedsbits.game.preview');
   adb('shell','input','keyevent','3');
   await ui.until('document.hidden');
   adb('shell','am','send-trim-memory','com.seedsbits.game.preview','COMPLETE');
   const memoryAfter=adb('shell','dumpsys','meminfo','-s','com.seedsbits.game.preview');
   stop();ui.close();ui=undefined;const saved=profiles().values[progress];
   assert.equal(saved.done.length,data.done.length);assert.equal(saved.meta.wallet,999);assert.equal(saved.meta.rewardReceipts.length,2048);assert.equal(saved.sessions.classic.current.moves,20);assert.equal(saved.jars.meter,beforeSeeds+2);
   launch();ui=await connect();await ui.tap('#resume');assert.equal(await ui.evaluate("document.querySelector('#remaining').textContent"),String(data.sessions.classic.current.board.filter(Boolean).length));
   ui.close();ui=undefined;stop();
   report.profiles.push({years,bytes:Buffer.byteLength(raw),done:saved.done.length,writeSamples:times,p50:sorted[Math.ceil(sorted.length*.5)-1],p95:sorted[Math.ceil(sorted.length*.95)-1],elapsedMs:performance.now()-boot,coldBootToFieldMs,coldBootScope:"Single QA launch-to-field including ADB/CDP/resume",frames,gfxinfo,memoryScope:"Host process PSS only; isolated WebView renderer is not summed",memoryBefore,memoryAfter,trimMemory:'COMPLETE',processDeath:true,retainedWallet:999,retainedReceipts:2048,replayDidNotRepay:true});checkpoint();
  }
  if (prior12108) {
   // Both payloads are re-signed with this run's common temporary CI key.
   // This proves APK upgrade/migration, separately from production identity.
   stop();adb('install','-r','-d',prior12108);
   const data=JSON.parse(fs.readFileSync('test-results/functional-profiles/archive-1.json','utf8'));
   await fixture({[progress]:data,[settings]:{tutorialDone:true,languageChoice:'en',sound:false,vibration:false,reminders:true}});
   launch();ui=await connect();await ui.tap('#resume');
   const cells=await ui.evaluate("[...document.querySelectorAll('#board [data-index]')].filter(e=>!e.disabled&&e.textContent.trim()).slice(0,2).map(e=>e.dataset.index)");
   await ui.tap(`#board [data-index="${cells[0]}"]`);await ui.tap(`#board [data-index="${cells[1]}"]`);await ui.until("document.querySelector('.game').dataset.persistence==='saved'");
   await ui.tap('#undo');await ui.until("document.querySelector('.game').dataset.persistence==='saved'");
   stop();ui.close();ui=undefined;
   const before=profiles().values[progress];
   if(!before?.meta)fs.writeFileSync(out+'/upgrade12108-missing-profile.xml',profiles().xml);
   assert(before?.meta,'The prior build must have a committed profile before upgrade');assert.equal(before.meta.wallet,999);
   // Deliberately stage Android's interrupted-write state, then test the real
   // framework loader, not just our root-side disk oracle.
   adb('shell',`if [ ! -f ${prefs}.bak ]; then mv ${prefs} ${prefs}.bak; fi`);
   // Rename keeps the committed inode's app UID/SELinux context; create the
   // unfinished replacement as the debuggable app, never as root.
   adb('shell',`run-as com.seedsbits.game.preview sh -c 'umask 077; printf "%s" "<map />" > ${prefs}'`);
   assert.deepEqual(profiles().values[progress].sessions,before.sessions);
   launch();ui=await connect();await ui.tap('#resume');
   assert.deepEqual(profiles().values[progress].sessions,before.sessions);assert.equal(profiles().values[progress].meta.wallet,999);
   report.atomicBackupRecovery={priorBuild:12108,primaryIncomplete:true,backupPreferred:true,actualAndroidReload:true,histories:true,wallet:999};
   stop();ui.close();ui=undefined;
   assert.match(adb('shell','dumpsys','package','com.seedsbits.game.preview'),/versionCode=12108\b/);
   adb('install','-r',candidate);launch();ui=await connect();await ui.tap('#resume');
   const after=profiles().values[progress];assert.equal(after.done.length,before.done.length);assert.deepEqual(after.sessions,before.sessions);assert.equal(after.meta.wallet,999);assert.deepEqual(after.meta.rewardReceipts,before.meta.rewardReceipts);assert.deepEqual(after.bookRevisions,before.bookRevisions);assert.deepEqual(after.dailyAssignments,before.dailyAssignments);
   report.upgrade12108={from:12108,source:'e592866145b0c2f537f01d21fb62a0e9e471d5e4',histories:true,assignments:true,wallet:999,receipts:after.meta.rewardReceipts.length,temporaryCommonCertificate:true,atomicBackupRecovery:true};ui.close();ui=undefined;stop();checkpoint();
  }
  for(const [from,prior] of [[12109,prior12109],[12110,prior12110],[12111,prior12111],[12112,prior12112]]){
   if(!prior)continue;
   stop();adb('install','-r','-d',prior);
   assert.match(adb('shell','dumpsys','package','com.seedsbits.game.preview'),new RegExp('versionCode='+from+'\\b'));
   const data=JSON.parse(fs.readFileSync('test-results/functional-profiles/archive-1.json','utf8'));
   await fixture({[progress]:data,[settings]:{tutorialDone:true,languageChoice:'en',sound:false,vibration:false,reminders:false,reminderTime:'17:47'}});
   launch();ui=await connect();await ui.tap('#resume');await ui.until("document.querySelector('.game').dataset.persistence!=='pending'");
   stop();ui.close();ui=undefined;const before=profiles().values;
   adb('install','-r',candidate);launch();ui=await connect();await ui.tap('#resume');
   const after=profiles().values;
   assert.deepEqual(after[progress].sessions,before[progress].sessions);assert.deepEqual(after[progress].done,before[progress].done);
   assert.equal(after[progress].meta.wallet,999);assert.deepEqual(after[progress].meta.rewardReceipts,before[progress].meta.rewardReceipts);
   assert.equal(after[settings].reminders,false);assert.equal(after[settings].reminderTime,'17:47');
   assert.deepEqual(after[progress].bookRevisions,before[progress].bookRevisions);assert.deepEqual(after[progress].dailyAssignments,before[progress].dailyAssignments);
   assert.equal(await ui.evaluate("document.querySelectorAll('#reminder-settings,#result-reminder').length"),0);
   report[`upgrade${from}`]={from,to:Number(adb('shell','dumpsys','package','com.seedsbits.game.preview').match(/versionCode=(\d+)\b/)[1]),histories:true,wallet:999,receipts:2048,pins:true,legacyOptOut:true,legacyCustomTimeRetained:true,temporaryCommonCertificate:true};
   ui.close();ui=undefined;stop();checkpoint();
  }
  // Android permission state is exercised through the real bridge, offline.
  // The preceding upgrade deliberately retained a game opt-out. The separate
  // scheduler/reboot scenario uses an explicitly enabled QA profile.
  await fixture({[settings]:{...profiles().values[settings],reminders:true}});
  for(const granted of [false,true,false]){
   stop();adb('shell','pm',granted?'grant':'revoke','com.seedsbits.game.preview','android.permission.POST_NOTIFICATIONS');launch();ui=await connect();
   const config=await ui.evaluate('window.Capacitor.Plugins.SeedsEngagement.configuration()');assert.equal(config.granted,granted);report.permissions.push({requested:granted,actual:config.granted});ui.close();ui=undefined;
  }
  const oldZone=adb('shell','getprop','persist.sys.timezone');
  try {
   for(const zone of ['Pacific/Kiritimati','America/Los_Angeles','Etc/GMT+12']){
    stop();adb('shell','setprop','persist.sys.timezone',zone);adb('shell','am','broadcast','-a','android.intent.action.TIMEZONE_CHANGED','--es','time-zone',zone);launch();ui=await connect();
    const value=await ui.evaluate(`({zone:Intl.DateTimeFormat().resolvedOptions().timeZone,date:new Date().toString(),ready:!document.querySelector('#app').inert})`);assert(value.ready);assert.equal(value.zone,zone);
    const nativeDay=adb('shell','date','+%F');await ui.tap('#daily-mode');
    await ui.until("!document.querySelector('#dialog').open");
    const active=profiles().values[progress].active;assert.equal(active.slice(-10),nativeDay,'Daily route must use the native local calendar day');
    report.timezones.push({requested:zone,...value,nativeDay,active});ui.close();ui=undefined;
   }
  } finally {stop();adb('shell','setprop','persist.sys.timezone',oldZone);adb('shell','am','broadcast','-a','android.intent.action.TIMEZONE_CHANGED','--es','time-zone',oldZone);}
  assert.notEqual(report.timezones[0].nativeDay,report.timezones[2].nativeDay,'The 26-hour offset must cross a calendar date');
  // Deliver the real notification entry Intent while the app is backgrounded.
  launch();ui=await connect();const beforeNotification=profiles().values[progress];
  adb('shell','input','keyevent','3');await ui.until('document.hidden');
  adb('shell','am','start','-W','-n','com.seedsbits.game.preview/.MainActivity','--ez','seeds_daily_notification','true');
  const notificationDay=adb('shell','date','+%F');
  await ui.until(`(async()=>{const p=JSON.parse((await window.Capacitor.Plugins.Preferences.get({key:${JSON.stringify(progress)}})).value);return p.active.endsWith(${JSON.stringify(notificationDay)})&&!document.querySelector('#dialog').open&&!document.querySelector('#app').inert;})()`);
  const notificationSave=profiles().values[progress];assert(notificationSave.active.endsWith(notificationDay));
  assert.deepEqual(notificationSave.sessions[beforeNotification.active].current.board,beforeNotification.sessions[beforeNotification.active].current.board);
  report.notificationEntry={fromBackground:true,expectedDay:notificationDay,active:notificationSave.active,priorBoardPreserved:true};ui.close();ui=undefined;
  // Actual emulator reboot: Android must reschedule while keeping preferences.
  stop();adb('shell','pm','grant','com.seedsbits.game.preview','android.permission.POST_NOTIFICATIONS');
  launch();ui=await connect();const granted=await ui.evaluate('window.Capacitor.Plugins.SeedsEngagement.configuration()');assert(granted.granted);
  adb('shell','input','keyevent','3');ui.close();ui=undefined;
  const beforeReboot=profiles().values[progress],beforeUptime=Number(adb('shell','cat','/proc/uptime').split(' ')[0]);adb('reboot');
  let booted=false;
  for(let attempt=0;attempt<120;attempt++){
   try{if(adb('shell','getprop','sys.boot_completed')==='1' && Number(adb('shell','cat','/proc/uptime').split(' ')[0])<beforeUptime){booted=true;break;}}catch{}
   await new Promise(resolve=>setTimeout(resolve,1000));
  }
  assert(booted,'Emulator did not finish reboot');adb('root');adb('wait-for-device');
  // MENU alone does not wake a display after the real reboot. These are
  // emulator input preconditions, not application lifecycle callbacks.
  adb('shell','input','keyevent','224');adb('shell','wm','dismiss-keyguard');adb('shell','input','keyevent','82');
  // Re-establish the offline gate after the emulator's firewall reset.
  adb('shell','svc','wifi','disable');adb('shell','svc','data','disable');
  adb('shell',"iptables -I OUTPUT '!' -o lo -j REJECT");adb('shell',"ip6tables -I OUTPUT '!' -o lo -j REJECT");
  let alarms='';for(let attempt=0;attempt<30;attempt++){alarms=adb('shell','dumpsys','alarm');if(alarms.includes('seeds.DAILY_REMINDER'))break;await new Promise(resolve=>setTimeout(resolve,500));}
  assert(alarms.includes('seeds.DAILY_REMINDER'),'Reminder was not rescheduled after reboot');
  report.rebootAlarm=alarms.split('\n').filter(line=>line.includes('seeds.DAILY_REMINDER')||line.includes('com.seedsbits.game.preview'));
  launch();ui=await connect();assert.equal(profiles().values[progress].done.length,beforeReboot.done.length);assert.equal(profiles().values[progress].meta.wallet,beforeReboot.meta.wallet);
  await ui.until('!document.hidden && document.hasFocus()');
  report.reboot={actualEmulatorReboot:true,kernelUptimeReset:true,retained:true,offline:true,foregroundAndFocus:true};ui.close();ui=undefined;
  // Exercise the first real native Preferences reply of each new document.
  // The dependency race oracle forces its interleaving separately; this gate
  // proves actual Android reload liveness and complete saved-state continuity.
  launch();ui=await connect();const reloadBaseline=profiles().values[progress];report.bridgeReloads=[];
  for(let trial=0;trial<10;trial++){
   const origin=await ui.evaluate('performance.timeOrigin');
   await ui.evaluate('setTimeout(()=>location.reload(),0);true');
   await ui.until(`performance.timeOrigin!==${origin} && !!document.querySelector('#dialog[open]') && !document.querySelector('#app').inert && !document.hidden && document.hasFocus()`);
   const after=await ui.evaluate(`window.Capacitor.Plugins.Preferences.get({key:${JSON.stringify(progress)}}).then(p=>JSON.parse(p.value))`);
   assert.deepEqual(after.sessions,reloadBaseline.sessions);assert.deepEqual(after.done,reloadBaseline.done);assert.deepEqual(after.bookRevisions,reloadBaseline.bookRevisions);assert.deepEqual(after.dailyAssignments,reloadBaseline.dailyAssignments);
   assert.equal(after.meta.wallet,reloadBaseline.meta.wallet);assert.deepEqual(after.meta.rewardReceipts,reloadBaseline.meta.rewardReceipts);assert.deepEqual(after.jars,reloadBaseline.jars);
   report.bridgeReloads.push({trial,newDocument:true,bootReady:true,nativeReply:true,historiesAndRightsRetained:true});
  }
  ui.close();ui=undefined;checkpoint();
  report.status='PASS';checkpoint();return report;
 } catch(error){report.status='ERROR';report.error=String(error);checkpoint();throw error;}
 finally {ui?.close();stop();await fixture(initial);}
}
