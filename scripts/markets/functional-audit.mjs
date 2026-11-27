import fs from 'node:fs';
import assert from 'node:assert/strict';
// QA driver only. No test fault or fixture is bundled into the application.
export async function verifyFunctionalAudit({adb,profiles,fixture,launch,stop,connect,progress,settings,out}) {
 const initial=profiles().values, report={source:process.env.GITHUB_SHA,physicalPhone:false,environment:'Android API35 offline emulator',recovery:[],profiles:[],permissions:[],timezones:[]};
 const checkpoint=()=>fs.writeFileSync(out+'/functional-audit.json',JSON.stringify(report,null,2));
 let ui;
 try {
  const puzzle=JSON.parse(fs.readFileSync('src/notebook.json','utf8'))[4],id=puzzle.id;
  for(let trial=0;trial<3;trial++){
   const data={version:3,active:id,done:[],seen:[],hints:{},sessions:{[id]:{rules:1,current:{board:puzzle.board,moves:0,scroll:0,additions:0},history:[]}},meta:{version:2,wallet:9,since:'2026-11-01',completed:0,unassisted:0,attempts:{[id]:{id:'native-recovery-'+trial,completed:false}},rewardReceipts:['prior-reward']}};
   await fixture({[progress]:data,[settings]:{tutorialDone:true,languageChoice:'en',sound:false,vibration:false}});launch();ui=await connect();await ui.tap('#resume');
   for(const [a,b] of [[3,4],[5,13],[6,15],[2,11]]){await ui.tap(`#board [data-index="${a}"]`);await ui.tap(`#board [data-index="${b}"]`);}
   await ui.until("document.querySelector('.game').dataset.persistence==='saved' && document.querySelector('#remaining').textContent==='4'");
   await ui.tap('#hint');await ui.until("document.querySelector('#no-moves-primary').textContent==='Undo 2 moves'");
   await ui.evaluate(`(()=>{const original=window.Capacitor.nativePromise;window.releaseRecovery=undefined;window.Capacitor.nativePromise=function(plugin,method,options){if(plugin==='SeedsMonetization'&&method==='persistState')return new Promise(resolve=>{window.releaseRecovery=()=>resolve(original.call(this,plugin,method,options));});return original.call(this,plugin,method,options);};return true;})()`);
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
   await ui.evaluate(`(()=>{window.nativeWrites=[];const original=window.Capacitor.nativePromise;window.Capacitor.nativePromise=function(plugin,method,options){const start=performance.now(),p=original.call(this,plugin,method,options);return plugin==='SeedsMonetization'&&method==='persistState'?p.then(value=>{window.nativeWrites.push(performance.now()-start);return value;}):p;};return true;})()`);
   const memoryBefore=adb('shell','dumpsys','meminfo','-s','com.seedsbits.game.preview');
   for(let sample=0;sample<10;sample++){
    const cells=await ui.evaluate("[...document.querySelectorAll('#board [data-index]')].filter(e=>!e.disabled&&e.textContent.trim()).slice(0,2).map(e=>e.dataset.index)");assert.equal(cells.length,2);
    await ui.tap(`#board [data-index="${cells[0]}"]`);await ui.tap(`#board [data-index="${cells[1]}"]`);await ui.until("document.querySelector('.game').dataset.persistence==='saved'");
    await ui.tap('#undo');await ui.until("document.querySelector('.game').dataset.persistence==='saved'");
   }
   const times=await ui.evaluate('window.nativeWrites'),sorted=[...times].sort((a,b)=>a-b);
   adb('shell','am','send-trim-memory','com.seedsbits.game.preview','COMPLETE');
   const memoryAfter=adb('shell','dumpsys','meminfo','-s','com.seedsbits.game.preview');
   stop();ui.close();ui=undefined;const saved=profiles().values[progress];
   assert.equal(saved.done.length,data.done.length);assert.equal(saved.meta.wallet,999);assert.equal(saved.meta.rewardReceipts.length,2048);assert.equal(saved.sessions.classic.current.moves,20);assert.equal(saved.jars.meter,beforeSeeds+2);
   launch();ui=await connect();await ui.tap('#resume');assert.equal(await ui.evaluate("document.querySelector('#remaining').textContent"),String(data.sessions.classic.current.board.filter(Boolean).length));
   ui.close();ui=undefined;stop();
   report.profiles.push({years,bytes:Buffer.byteLength(raw),done:saved.done.length,writeSamples:times,p50:sorted[Math.ceil(sorted.length*.5)-1],p95:sorted[Math.ceil(sorted.length*.95)-1],elapsedMs:performance.now()-boot,memoryBefore,memoryAfter,trimMemory:'COMPLETE',processDeath:true,retainedWallet:999,retainedReceipts:2048,replayDidNotRepay:true});checkpoint();
  }
  // Android permission state is exercised through the real bridge, offline.
  for(const granted of [false,true,false]){
   stop();adb('shell','pm',granted?'grant':'revoke','com.seedsbits.game.preview','android.permission.POST_NOTIFICATIONS');launch();ui=await connect();
   const config=await ui.evaluate('window.Capacitor.Plugins.SeedsEngagement.configuration()');assert.equal(config.granted,granted);report.permissions.push({requested:granted,actual:config.granted});ui.close();ui=undefined;
  }
  const oldZone=adb('shell','getprop','persist.sys.timezone');
  try {
   for(const zone of ['Pacific/Kiritimati','America/Los_Angeles']){
    stop();adb('shell','setprop','persist.sys.timezone',zone);adb('shell','am','broadcast','-a','android.intent.action.TIMEZONE_CHANGED','--es','time-zone',zone);launch();ui=await connect();
    const value=await ui.evaluate(`({zone:Intl.DateTimeFormat().resolvedOptions().timeZone,date:new Date().toString(),ready:!document.querySelector('#app').inert})`);assert(value.ready);assert.equal(value.zone,zone);report.timezones.push({requested:zone,...value});ui.close();ui=undefined;
   }
  } finally {stop();adb('shell','setprop','persist.sys.timezone',oldZone);}
  report.status='PASS';checkpoint();return report;
 } catch(error){report.status='ERROR';report.error=String(error);checkpoint();throw error;}
 finally {ui?.close();stop();await fixture(initial);}
}
