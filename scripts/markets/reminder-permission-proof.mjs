import fs from 'node:fs';
import assert from 'node:assert/strict';

// QA only: respond to the actual first-result Android dialog, never a JS double.
export async function declineAutomaticReminder({ui,adb,profiles,progress,settings,out,shot}) {
  await ui.until("document.querySelector('#app').inert");
  let xml='',button;
  for(let attempt=0;attempt<20;attempt++){
    adb('shell','uiautomator','dump','/sdcard/seeds-reminder-permission.xml');
    xml=adb('shell','cat','/sdcard/seeds-reminder-permission.xml');
    button=[...xml.matchAll(/<node\b[^>]*>/g)].map(m=>m[0]).find(n=>n.includes(':id/permission_deny_button"')&&/package="com\.(?:google\.)?android\.permissioncontroller"/.test(n));
    if(button)break;
    await new Promise(resolve=>setTimeout(resolve,150));
  }
  assert(button,'Actual Android notification permission dialog must appear');
  // Inert also covers preparation while the marker's write is still pending.
  // Observe the real system dialog before checking its durable prerequisites.
  const before=profiles().values[progress];
  assert(before.meta.flags.includes('reminder_permission_requested'),'Request marker must be durable when the system prompt is visible');
  assert(before.meta.completed>0,'Permission follows a genuinely stored completed puzzle');
  assert.equal(await ui.evaluate("document.querySelectorAll('#jar-spill,.flying-seed,.result-seed-burst,.trophy-confetti').length"),0,'Reward effects finish before the native prompt');
  fs.writeFileSync(out+'/automatic-reminder-permission.xml',xml);
  shot('automatic-reminder-permission');
  const bounds=/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/.exec(button);assert(bounds);
  adb('shell','input','tap',String(Math.round((+bounds[1]+ +bounds[3])/2)),String(Math.round((+bounds[2]+ +bounds[4])/2)));
  await ui.until("!document.querySelector('#app').inert && document.hasFocus() && !document.hidden");
  await ui.until(`window.Capacitor.Plugins.Preferences.get({key:${JSON.stringify(progress)}}).then(v=>JSON.parse(v.value).meta.flags.includes('reminder_permission_denied'))`);
  const after=profiles().values;
  assert.notEqual(after[settings].reminders,false,'A new Android denial must not create a legacy game opt-out');
  const config=await ui.evaluate('window.Capacitor.Plugins.SeedsEngagement.configuration()');assert.equal(config.granted,false);
  return {actualSystemDialog:true,action:'deny',storedCompleted:before.meta.completed,requestMarkerStoredBeforePrompt:true,
    afterReward:true,denialStored:true,gameOptOutCreated:false,granted:config.granted};
}
