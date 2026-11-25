import { chromium } from "playwright";
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const [before,after,out]=process.argv.slice(2);
if(!before||!after||!out)throw Error("Usage: node scripts/capture-menu-package.mjs BEFORE_URL AFTER_URL OUTPUT_DIRECTORY");
mkdirSync(join(out,"frames"),{recursive:true});mkdirSync(join(out,"videos"),{recursive:true});
const executablePath=process.env.SEEDS_CHROMIUM;
const browser=await chromium.launch({executablePath,args:["--no-sandbox"]});
const old=JSON.parse(readFileSync("src/content-v5-books-4.json","utf8"))[2180-1801];
const key="seeds-bits.progress.v2";
const fixture={version:9,active:"classic",done:[],seen:[],hints:{},bookRevisions:{"book-v1-2180":5},
 lastBookTask:"book-v1-2180",sessions:{classic:{rules:1,current:{board:[5,5,4,6,1,9,5,5,8,2,3,7],moves:2,scroll:0,additions:0},packedHistory:[]},
 "book-v1-2180":{rules:1,current:{board:[...old[0]].map(Number),moves:1,scroll:0,additions:0},packedHistory:[]}}};

async function prepare(ctx,language,theme,native=false) {
  await ctx.addInitScript(({fixture,key,language,theme,native})=>{
    if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(fixture));
    localStorage.setItem("seeds-bits.settings.v1",JSON.stringify({tutorialDone:true,languageChoice:language,theme,sound:false,vibration:false}));
    if(native) window.__SEEDS_ADS_TEST__={
      initialize:async()=>({enabled:true,test:true}),addListener:async()=>({remove:async()=>{}}),
      banner:async()=>{},preload:async()=>{},pending:async()=>({}),report:async()=>{},
      show:async()=>({shown:false,status:"skipped",reason:"test_no_fill"}),acknowledge:async()=>{},
    };
  },{fixture,key,language,theme,native});
}
async function save(page,name) {
  await page.evaluate(()=>document.fonts.ready);
  await page.screenshot({path:join(out,"frames",name+".jpg"),type:"jpeg",quality:87,animations:"disabled"});
}
async function take(url,variant,width,height,language,theme) {
  const ctx=await browser.newContext({viewport:{width,height},locale:language,reducedMotion:"reduce"});
  try {
    await prepare(ctx,language,theme,variant==="after");
    const page=await ctx.newPage();
    await page.goto(url);
    await page.locator('#dialog[data-screen="home"][open]').waitFor();
    const stem=`${variant}-${width}x${height}-${language}-${theme}`;
    await save(page,stem+"-home");
    await page.locator("#book-mode").click();
    await save(page,stem+"-notebook");
    await page.locator(variant==="before"?"#other-books summary":"#all-books").click();
    await save(page,stem+"-picker");
  } finally {await ctx.close();}
}
async function record() {
  const ctx=await browser.newContext({viewport:{width:390,height:844},locale:"ru",
    recordVideo:{dir:join(out,"videos"),size:{width:390,height:844}}});
  await prepare(ctx,"ru","dark",true);
  const page=await ctx.newPage();
  try {
    await page.goto(after);
    await page.locator("#book-mode").click();
    await page.waitForTimeout(550);
    await page.locator("#all-books").click();
    await page.waitForTimeout(550);
    await page.locator('#dialog [data-volume="90"]').click();
    await page.waitForTimeout(550);
    await page.locator("#continue-book").click();
    await page.waitForTimeout(600);
    await page.locator("#menu").click();
    await page.waitForTimeout(550);
    await page.locator("#daily-mode").click();
    await page.waitForTimeout(600);
    await page.locator("#menu").click();
    await page.waitForTimeout(550);
    await page.locator("#book-quick").click();
    await page.waitForTimeout(800);
  } finally {await ctx.close();}
}
try {
  for(const [width,height] of [[320,568],[360,640],[390,844],[844,390],[820,600]]) {
    for(const language of width>390?["ru","en"]:["ru","en","es","tr","pt-BR"]) {
      for(const theme of ["light","dark"]) {
        await take(before,"before",width,height,language,theme);
        await take(after,"after",width,height,language,theme);
      }
    }
  }
  await record();
} finally {await browser.close();}
