import registry from "./distribution-channels.json" with {type:"json"};
import { CommittedAnalytics, enqueueAnalytics, readAnalytics, type AnalyticsEvent, type EventData } from "./analytics";

export type InstallContext = {
  install_store: string;
  artifact_channel: string;
  store_evidence: string;
  acquisition_state: "fresh" | "legacy" | "undetermined";
};
export type WebContext = { portal_id: string; distributor_id: string; portal_evidence: string };
const portals = new Set(registry.channels.filter(c=>c.surface==="web").map(c=>c.id));
const networks = new Set(registry.channels.filter(c=>c.role.startsWith("network")).map(c=>c.id));
export function identifyPortal(input: {
  buildPortal?: string; sdkPortal?: string; distributor?: string; verifiedOrigin?: boolean; direct?: boolean; conflict?:boolean;
}): WebContext {
  const build = input.buildPortal && portals.has(input.buildPortal) ? input.buildPortal : undefined;
  const reported = input.sdkPortal && portals.has(input.sdkPortal) ? input.sdkPortal : undefined;
  const distributor_id = input.distributor && networks.has(input.distributor) ? input.distributor : "unknown";
  if (input.conflict || (reported && build && reported !== build)) return {portal_id:"unknown", distributor_id, portal_evidence:"conflict"};
  if (reported) return {portal_id:reported, distributor_id, portal_evidence:"sdk"};
  if (build && input.verifiedOrigin) return {portal_id:build, distributor_id, portal_evidence:"verified_origin"};
  if (input.direct) return {portal_id:"direct_web", distributor_id, portal_evidence:"first_party_origin"};
  return {portal_id:"unknown", distributor_id, portal_evidence:"unavailable"};
}

const DAY = new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Yekaterinburg",year:"numeric",month:"2-digit",day:"2-digit"});
export function activityDate(at = Date.now()) {
  return DAY.formatToParts(at).filter(p=>p.type!=="literal").map(p=>p.value).join("-");
}
type WebState = {
  id: string; last: number; date: string; entered: boolean; legacy: boolean; analytics: AnalyticsEvent[];
};
/** Portal-scoped profile and bounded journal. Each mutation reads the current snapshot under the same lock. */
export class WebAcquisition {
  private key: string;
  private temporary?: WebState;
  private scoped = true;
  private inflight = new CommittedAnalytics(event=>this.send(event));
  constructor(private source: WebContext, private legacy: boolean,
    private enabled: () => boolean, private send: (event:AnalyticsEvent)=>Promise<boolean>) {
    this.key = "seeds-bits.distribution.v1." + source.portal_id + (source.portal_id==="unknown" ? "."+source.distributor_id : "");
  }
  private state(): WebState {
    const empty: WebState = {id:crypto.randomUUID(),last:0,date:"",entered:false,legacy:this.legacy,analytics:[]};
    if (!this.scoped) return this.temporary ?? empty;
    try {
      const value = JSON.parse(localStorage.getItem(this.key) ?? "null") as WebState|null;
      return value && typeof value.id==="string" ? {...value,analytics:readAnalytics(value.analytics)} : empty;
    } catch {
      this.scoped=false;
      return this.temporary ?? empty;
    }
  }
  private mutate(update:(state:WebState)=>void) {
    const run=()=>{
      const state=this.state();
      update(state);
      if (this.scoped) try {localStorage.setItem(this.key,JSON.stringify(state));}
      catch { this.scoped=false; }
      if (!this.scoped) this.temporary=state;
      return state;
    };
    return navigator.locks ? navigator.locks.request(this.key,run) : Promise.resolve(run());
  }
  private async flush() {
    const current=await this.mutate(state=>{
      if(!this.enabled()) state.analytics=[];
    });
    if (!current.analytics.length || !this.enabled()) return;
    void this.inflight.publish(current.analytics,id=>{
      void this.mutate(state=>{state.analytics=state.analytics.filter(e=>e.id!==id);});
    });
  }
  private details(state:WebState, data:EventData = {}) {
    return {...data,...this.source,profile_id:state.id,storage_scope:this.scoped?"persistent":"session_only",
      acquisition_state:this.scoped ? state.legacy?"legacy":"fresh" : "undetermined"};
  }
  async activity(data:EventData) {
    // Probe persistence before recording a first profile. A failed write must not create a persistent cohort.
    await this.mutate(()=>{});
    await this.mutate(state=>{
      const now=Date.now(),date=activityDate(now);
      if (this.enabled()) {
        const fields=this.details(state,{...data,activity_day:date});
        if (!state.entered && !state.legacy && this.scoped && this.source.portal_id!=="unknown")
          enqueueAnalytics(state,"web_first_play",fields);
        if (!state.entered || now-state.last>=30*60*1000)
          enqueueAnalytics(state,"web_session_open",fields);
        if (this.scoped && state.entered && state.date!==date)
          enqueueAnalytics(state,"activity_day",fields);
      }
      state.entered=true;
      state.last=now;
      state.date=date;
    });
    await this.flush();
  }
  async event(name:string, data:EventData) {
    await this.mutate(state=>{
      if(this.enabled()) enqueueAnalytics(state,name,this.details(state,data));
    });
    await this.flush();
  }
  async product(event:AnalyticsEvent) {
    if(!this.enabled()) return true;
    const state=await this.mutate(()=>{});
    return this.enabled() && this.send({...event,data:this.details(state,event.data)});
  }
}
