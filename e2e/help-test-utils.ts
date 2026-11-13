import {expect, type Page} from "@playwright/test";
export const key = "seeds-bits.progress.v2";
export async function install(page: Page, state = "ready", profile = "") {
  await page.addInitScript(({key, state}) => {
    const w = window as any;
    if (!localStorage.seededHelp) {
      localStorage.seededHelp = "1";
      localStorage.setItem("seeds-bits.settings.v1", JSON.stringify({tutorialDone: true}));
      localStorage.setItem(key, JSON.stringify({version:3, active:"classic", sessions:{classic:{rules:1,current:{board:Array(18).fill(5),scroll:0,moves:0,additions:0},history:[]}},hints:{},done:[],seen:[],meta:{version:2,wallet:0,since:"2026-11-13",completed:0,unassisted:0,attempts:{classic:{id:"help-attempt",completed:false,hintKeys:["used1","used2","used3"]}}}}));
    }
    w.acks=[]; w.events=[]; w.requests=[]; const listeners: Record<string, Function> = {};
    w.nativeState={state,reason:state};
    w.setReady=(s:string)=>{w.nativeState={state:s,reason:s};listeners.rewardedState?.(w.nativeState);};
    const pending=()=>JSON.parse(localStorage.nativeHelp ?? "null");
    w.__SEEDS_ADS_TEST__={initialize:async()=>({enabled:true,test:true,readiness:w.nativeState,reward:pending()}),
      addListener:async(n:string,f:Function)=>{listeners[n]=f;return {remove:async()=>{}};},
      readiness:async()=>w.nativeState, preload:async()=>{},banner:async()=>{}, report:async(e:any)=>{w.events.push(e);return {accepted:true};},
      pending:async()=>({reward:pending()}),acknowledge:async(r:any)=>{if(w.ackFail)throw Error("ack");w.acks.push(r);localStorage.removeItem("nativeHelp");},
      show:async(o:any)=>{
        w.requests.push(o);
        if(w.unavailable)return {status:"unavailable",reward:pending()};
        const receipt={token:"earned-"+o.ad_session_id,attempt:o.attempt,version:1,product:o.product,intent_id:o.intent_id,offer_id:o.offer_id,ad_session_id:o.ad_session_id};
        const button=document.createElement("button");button.id="qa-ad";button.textContent="Завершить QA видео";button.style.cssText="position:fixed;inset:0;z-index:99999";document.body.append(button);
        w.earnNow=()=>{localStorage.nativeHelp=JSON.stringify(receipt);listeners.reward?.(receipt);listeners.reward?.(receipt);};
        await new Promise<void>(resolve=>button.onclick=()=>resolve());button.remove();
        if(w.closeOnly)return {status:"closed",shown:true};
        w.earnNow();return {status:"closed",shown:true,reward:receipt};
      }};
  }, {key,state});
  await page.goto(profile ? `/?qa=${profile}` : "/"); await page.locator("#resume").click();
}
export async function watch(page: Page) {await page.locator("#hint").click();await page.locator("#watch-hints").click();await expect(page.locator("#qa-ad")).toBeVisible();}
export async function wallet(page: Page) {return page.evaluate(k=>JSON.parse(localStorage.getItem(k)!).meta.wallet,key);}
