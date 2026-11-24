import fs from "node:fs";
import assert from "node:assert/strict";
import {marketReport} from "./report.mjs";
const day1="2026-11-19T04:00:00Z",day2="2026-11-20T04:00:00Z";
const installation=(installation_id)=>({application_id:"android-control",installation_id,installation_datetime:day1,qa:true});
const context=(installation_id,store,artifact)=>({name:"distribution_context",data:{
  surface:"android",application_id:"android-control",installation_id,event_id:installation_id+"-context",qa:true,
  acquisition_state:"fresh",install_store:store,artifact_channel:artifact,
  store_evidence:store==="unknown"?"unavailable":"installer_package",requested_locale:"ru-KZ",initial_ui_language:"ru",
  occurred_at:day1,
}});
const known = context("install-a","rustore","rustore");
const nash = context("install-b","nashstore","nashstore");
const forwarded = context("install-c","unknown","rustore");
const fixtures = {
  installations:["install-a","install-b","install-c"].map(installation),
  events:[known,nash,forwarded,{...known,data:{...known.data,occurred_at:day2}},
    {name:"distribution_context",data:{...known.data,event_id:"diagnostic-update",occurred_at:day2,install_store:"nashstore"}},
    {name:"first_unassisted_pair",data:{...known.data,event_id:"a-pair"}},
    {name:"game_complete",data:{...known.data,event_id:"a-task",mode:"notebook"}},
    {name:"activity_day",data:{...known.data,event_id:"a-d1",occurred_at:day2}},
  ],
};
const start={surface:"web",qa:true,portal_id:"ok_games",distributor_id:"gamepush",portal_evidence:"sdk",
  profile_id:"ok-control",storage_scope:"persistent",acquisition_state:"fresh",occurred_at:day1,
  requested_locale:"pt-PT",ui_language:"pt-BR",event_id:"web-control-ok"};
fixtures.events.push({name:"web_first_play",data:start},{name:"web_first_play",data:start},
  {name:"web_session_open",data:{...start,event_id:"web-ok-session"}},
  {name:"activity_day",data:{...start,event_id:"web-ok-d1",occurred_at:day2}},
  {name:"language_picker_open",data:{...start,event_id:"web-picker"}},
  {name:"language_changed",data:{...start,event_id:"web-lang",from_mode:"auto",to_mode:"manual",from_language:"pt-BR",to_language:"pt-BR"}},
  {name:"web_session_open",data:{...start,event_id:"session-only",profile_id:"no-storage",storage_scope:"session_only"}});
const cfg={from:"2026-11-19",to:"2026-11-21",asOf:"2026-11-22",includeQA:true};
const summary=marketReport(fixtures,cfg);
assert.equal(summary.androidInstalls.reduce((n,r)=>n+r.installs,0),3);
assert.equal(summary.androidInstalls.find(r=>r.confirmedStore==="unknown").artifactChannel,"rustore");
assert.equal(summary.cohorts.find(r=>r.channel==="ok_games").newProfiles,1);
assert.equal(summary.cohorts.find(r=>r.channel==="ok_games").d1,1);
assert.equal(summary.languagePicker.find(r=>r.channel==="ok_games").modeOnly,1);
assert.equal(summary.webSessionOnly,1);
assert.equal(marketReport(fixtures,{...cfg,includeQA:false}).androidInstalls.length,0);
const file=process.argv[2];
const actualBrowser=file?JSON.parse(fs.readFileSync(file,"utf8")):null;
if(actualBrowser){
  const actual=marketReport(actualBrowser,{...cfg,from:"2026-11-01",to:"2026-11-30",asOf:"2026-12-01"});
  const portal = actual.cohorts.find(r=>r.channel==="yandex_games");
  assert.equal(portal.newProfiles,1);
  assert.equal(portal.firstPair,1);
  assert.equal(portal.firstPuzzle,1);
  assert.equal(portal.d1,1);
  assert.equal(actual.languagePicker.find(r=>r.channel==="yandex_games").changes,2);
  console.log(JSON.stringify({syntheticControls:summary,browserSDKDouble:actual},null,2));
}else console.log(JSON.stringify(summary,null,2));
