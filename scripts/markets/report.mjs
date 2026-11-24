import fs from "node:fs";
import {pathToFileURL} from "node:url";

const dateShift = (day, days) => new Date(Date.parse(day+"T00:00:00Z")+86400000*days).toISOString().slice(0,10);
function timestamp(value) {
  if (typeof value==="number") return value<1e11?value*1000:value;
  return Date.parse(value);
}
export function marketReport({installations=[], events=[]}, {
  from, to, asOf, timezone="Asia/Yekaterinburg", includeQA=false, delayMinutes=0,
}) {
  if(![from,to,asOf].every(x=>/^\d{4}-\d{2}-\d{2}$/.test(x??"")) || from>to || to>asOf)
    throw Error("Expected inclusive dates in YYYY-MM-DD order");
  const formatter=new Intl.DateTimeFormat("en-CA",{timeZone:timezone,year:"numeric",month:"2-digit",day:"2-digit"});
  const day=t=>formatter.format(timestamp(t));
  const period=d=>d>=from&&d<=to;
  const inScope=row=>includeQA || ![true,1,"1","true"].includes(row.qa);
  const installKey=row=>row.application_id!=null && row.installation_id!=null
    ? [row.application_id,row.installation_id].join(":") : undefined;
  const byEvent=(e)=>e.data.surface==="android"?installKey(e.data):
    e.data.profile_id?["web",e.data.portal_id,e.data.profile_id].join(":"):undefined;
  const rows=events.flatMap(e=>{
    let fields=e.data??e.event_json??{};
    if(typeof fields==="string")try { fields=JSON.parse(fields); }catch { return []; }
    const row={name:e.name??e.event_name,data:{
      application_id:e.application_id,installation_id:e.installation_id,
      ...fields,occurred_at:fields.occurred_at??e.event_timestamp??e.event_datetime,
    }};
    return row.data.event_id && inScope(row.data) && Number.isFinite(timestamp(row.data.occurred_at))?[row]:[];
  }).sort((a,b)=>timestamp(a.data.occurred_at)-timestamp(b.data.occurred_at));
  const seen=new Set();
  const unique=rows.filter(e=>{
    const k=[e.data.surface,e.data.application_id??e.data.portal_id,e.data.event_id].join(":");
    if(seen.has(k))return false;
    seen.add(k);
    return true;
  });
  const contexts=new Map();
  for(const e of unique) {
    const k=installKey(e.data);
    if(k&&e.name==="distribution_context"&&["fresh","legacy","undetermined"].includes(e.data.acquisition_state)&&!contexts.has(k))
      contexts.set(k,e.data);
  }
  const profiles=new Map();
  const ensure=(k,initial)=>{if(!profiles.has(k))profiles.set(k,{...initial,events:[],days:new Set()});return profiles.get(k);};
  const android=[];
  const installationsSeen=new Set();
  for(const row of installations) {
    const initial=installKey(row), start=row.installation_timestamp??row.installation_datetime;
    if(!initial || !Number.isFinite(timestamp(start)) || !inScope(row))continue;
    const record=contexts.get(initial);
    if(record && !inScope(record))continue;
    const startDay=day(start), reinc=[true,1,"1","true"].includes(row.is_reinstallation);
    const recordId=[initial,start,reinc].join(":");
    if(installationsSeen.has(recordId))continue;
    installationsSeen.add(recordId);
    const details={surface:"android",channel:record?.install_store??"unknown",artifact:record?.artifact_channel??"unknown",
      evidence:record?.store_evidence??"no_context",state:record?.acquisition_state??"no_context",
      requested:record?.requested_locale??"unknown",ui:record?.initial_ui_language??"unknown",startDay,reinc};
    if(period(startDay))android.push({...details,application_id:row.application_id});
    ensure(initial,{...details,cohort:record?.acquisition_state==="fresh"&&!reinc});
  }
  const sessionOnly=[];
  for(const e of unique) {
    const k=byEvent(e);
    if(!k)continue;
    const current=day(e.data.occurred_at);
    if(e.name==="web_session_open"&&e.data.storage_scope==="session_only"&&period(current))sessionOnly.push(e.data);
    if(e.data.surface==="web" && e.data.storage_scope==="persistent" && e.data.portal_id!=="unknown") {
      const context={surface:"web",channel:e.data.portal_id,distributor:e.data.distributor_id,
        evidence:e.data.portal_evidence,requested:e.data.requested_locale,ui:e.data.ui_language,startDay:current};
      const profile=ensure(k,{...context,cohort:false});
      if(!profile.cohort && e.name==="web_first_play" && e.data.acquisition_state==="fresh")
        Object.assign(profile,context,{cohort:true});
    }
    const profile=profiles.get(k);
    if(!profile)continue;
    profile.events.push(e);
    if(["web_session_open","activity_day","game_start","game_complete","first_unassisted_pair"].includes(e.name))
      profile.days.add(current);
  }
  const summary=new Map(), languages=new Map();
  for(const p of profiles.values()){
    const key=[p.surface,p.channel,p.distributor??"",p.artifact??""].join("/");
    if(p.cohort&&period(p.startDay)){
      const row=summary.get(key)??{surface:p.surface,channel:p.channel,...(p.distributor?{distributor:p.distributor}:{}),
        ...(p.artifact?{artifact:p.artifact}:{}),newProfiles:0,firstPair:0,firstPuzzle:0,d1Eligible:0,d1:0,localeMatrix:{}};
      row.newProfiles++;
      if(p.events.some(e=>e.name==="first_unassisted_pair"))row.firstPair++;
      if(p.events.some(e=>e.name==="game_complete"&&["daily","notebook"].includes(e.data.mode)))row.firstPuzzle++;
      if(dateShift(p.startDay,1)<asOf) {
        row.d1Eligible++;
        if(p.days.has(dateShift(p.startDay,1)))row.d1++;
      }
      const locale=(p.requested??"unknown")+" → "+(p.ui??"unknown");
      row.localeMatrix[locale]=(row.localeMatrix[locale]??0)+1;
      summary.set(key,row);
    }
    const active=[...p.days].some(period);
    const checks=p.events.filter(e=>period(day(e.data.occurred_at)));
    const openings=checks.filter(e=>e.name==="language_picker_open");
    const changes=checks.filter(e=>e.name==="language_changed");
    if(active||openings.length||changes.length){
      const row=languages.get(key)??{surface:p.surface,channel:p.channel,...(p.distributor?{distributor:p.distributor}:{}),
        active:0,opened:0,openings:0,changed:0,changes:0,languageChanges:0,modeOnly:0};
      row.active+=+active;
      row.opened+=+(openings.length>0);
      row.openings+=openings.length;
      row.changed+=+(changes.length>0);
      row.changes+=changes.length;
      row.languageChanges+=changes.filter(e=>e.data.from_language!==e.data.to_language).length;
      row.modeOnly+=changes.filter(e=>e.data.from_language===e.data.to_language&&e.data.from_mode!==e.data.to_mode).length;
      languages.set(key,row);
    }
  }
  const grouped=new Map();
  for(const r of android) {
    const key=[r.application_id,r.channel,r.artifact,r.state,r.evidence,r.reinc].join("/");
    const row=grouped.get(key)??{application_id:r.application_id,confirmedStore:r.channel,
      artifactChannel:r.artifact,acquisitionState:r.state,evidence:r.evidence,reinstallation:r.reinc,installs:0};
    row.installs++;
    grouped.set(key,row);
  }
  return {from,to,asOf,timezone,includeQA,delayMinutes,uniqueEvents:unique.length,
    androidInstalls:[...grouped.values()],webSessionOnly:sessionOnly.length,
    cohorts:[...summary.values()],languagePicker:[...languages.values()]};
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  const [source, config]=process.argv.slice(2);
  console.log(JSON.stringify(marketReport(JSON.parse(fs.readFileSync(source,"utf8")),
    JSON.parse(fs.readFileSync(config,"utf8"))),null,2));
}
