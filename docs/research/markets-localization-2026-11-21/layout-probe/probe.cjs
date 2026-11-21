// Run from a Seeds checkout with its Playwright dependencies installed.
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { chromium } = require(require.resolve("playwright", {paths:[process.cwd()]}));
const copy = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const output = process.argv[3];
const url = process.argv[4] || "https://seeds.test";
const probeStates = [];
const snapshots = {};
let months;
const profiles = [[320,568,1],[320,568,2],[568,320,1],[568,320,2]];
const tick = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

async function inventory(page, state) {
  snapshots[state] = await page.evaluate(() => {
    const root = document.querySelector("dialog[open]") || document.querySelector(".game");
    const strings = new Set();
    for (const e of [root, ...root.querySelectorAll("*")]) {
      if (!e.getClientRects().length || e.closest("[hidden]") || getComputedStyle(e).visibility === "hidden") continue;
      for (const text of [e.getAttribute("aria-label"), ...[...e.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent)]) {
        if (text && /[А-Яа-яЁё]/u.test(text)) strings.add(text.trim().replace(/\s+/g, " "));
      }
    }
    return [...strings];
  });
}

async function geometry(page, state, key, params, viewport, scale) {
  const cue = page.locator(".opening-copy");
  const format = (id, l) => copy.messages[id][l].replace(/\{(\w+)\}/g, (_,k) => String(params[k]));
  const sample = l => key.map(k => format(k,l)).join(" · ");
  const expected = state === "invalidSum" ? "Эти цифры разные и не дают 10 в сумме." : sample("ru");
  await page.waitForFunction(text => document.querySelector(".opening-copy")?.textContent === text, expected, {timeout:6500});
  const original = await cue.innerText();
  assert.equal(original, expected, state);
  const payload = copy.locales.map(l => ({l, cue:sample(l)}));
  const rows = await page.evaluate(payload => {
    const element = document.querySelector(".opening-copy"), slot = document.querySelector("#page-progress");
    const viewport = document.querySelector("#viewport");
    const original = element.textContent, oldLang = element.lang, scroll = slot.scrollTop;
    const rows = [];
    for (const row of payload) {
      element.textContent = row.cue;
      element.lang = row.l;
      slot.scrollTop = 0;
      const range = document.createRange();
      range.selectNodeContents(element);
      const lines = [...range.getClientRects()].filter(r => r.width > 0 && r.height > 0);
      const sb = slot.getBoundingClientRect(), parent = document.querySelector(".game-top");
      const top = parent.getClientRects().length && getComputedStyle(parent).display !== "contents" ? parent.getBoundingClientRect() : {bottom:innerHeight,left:0,right:innerWidth};
      const bottom = Math.min(innerHeight, sb.top + slot.clientTop + slot.clientHeight, top.bottom);
      const left = Math.max(0, sb.left + slot.clientLeft, top.left);
      const right = Math.min(innerWidth, sb.left + slot.clientLeft + slot.clientWidth, top.right);
      const vb = viewport.getBoundingClientRect();
      const cellTests = [...document.querySelectorAll("#board button[data-index]")].filter(e=>e.textContent.trim()).map(e => {
        const r = e.getBoundingClientRect(), x = r.x + r.width/2, y = r.y + r.height/2;
        if (x < Math.max(0,vb.left) || x >= Math.min(innerWidth,vb.right) || y < Math.max(0,vb.top) || y >= Math.min(innerHeight,vb.bottom)) return null;
        return e.contains(document.elementFromPoint(x,y));
      }).filter(v => v !== null);
      rows.push({lang:row.l, lines:lines.length, belowPx:Math.max(0, Math.ceil(Math.max(...lines.map(r=>r.bottom))-bottom-1)), sidePx:Math.max(0, ...lines.map(r=>Math.ceil(Math.max(left-r.left,r.right-right)-1))), boardTop:vb.top, boardHeight:vb.height, hit:cellTests.filter(Boolean).length, tested:cellTests.length, scrollExtra:slot.scrollHeight-slot.clientHeight});
    }
    element.textContent=original; element.lang=oldLang; slot.scrollTop=scroll;
    return rows;
  },payload);
  probeStates.push(...rows.map(r=>({viewport,scale,state,...r})));
  if (process.env.PROBE_SCREENSHOT && viewport==="568x320" && scale===2 && state==="edge") {
    await cue.evaluate((e,text)=>{e.lang="de"; e.textContent=text;},sample("de"));
    await page.screenshot({path:process.env.PROBE_SCREENSHOT});
    await cue.evaluate((e,text)=>{e.lang=""; e.textContent=text;},original);
  }
}

async function run(browser, [width,height,scale], collect) {
  const context = await browser.newContext({viewport:{width,height},reducedMotion:"reduce",timezoneId:"Asia/Yekaterinburg",locale:"ru-RU"});
  if (!process.argv[4]) {
    const root = path.resolve("dist");
    await context.route("https://seeds.test/**", route => {
      const pathname = new URL(route.request().url()).pathname;
      const file = path.resolve(root, "." + (pathname === "/" ? "/index.html" : pathname));
      if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) return route.fulfill({status:404,body:""});
      return route.fulfill({path:file});
    });
  }
  const p = await context.newPage();
  await p.clock.setFixedTime(new Date("2026-11-21T12:00:00+05:00"));
  await p.goto(url);
  await p.locator(".opening-copy").waitFor();
  if (collect) months = await p.evaluate(languages => Object.fromEntries(languages.map(language=>{
    const format = opts => new Intl.DateTimeFormat(language,{...opts,timeZone:"UTC"});
    const withYear = format({month:"long",year:"numeric"}), standalone = format({month:"long"});
    const labels = Array.from({length:12},(_,i)=>{const day=Date.UTC(2025,i,1); return [withYear.format(day).split(" ")[0],standalone.format(day)];});
    return [language,labels];
  })),copy.locales);
  await p.evaluate(scale=>{
    document.documentElement.classList.add("has-mobile-ads");
    if (scale===1) return;
    const els=[...document.querySelectorAll("body *")],sizes=els.map(e=>getComputedStyle(e).fontSize);
    els.forEach((e,i)=>e.style.fontSize=parseFloat(sizes[i])*scale+"px");
  },scale);
  await tick(p);
  const measure = (state,key,params={}) => geometry(p,state,key,params,width+"x"+height,scale);
  const digit = i => p.locator('#board [data-index="'+i+'"]').click();
  const move = async(a,b)=>{const before=Number(await p.locator("#remaining").innerText()); await digit(a); await digit(b); await p.waitForFunction(n=>Number(document.querySelector("#remaining").textContent)===n,before-2);};
  await measure("first",["open.tap"]); if (collect) await inventory(p,"first");
  await digit(4); await measure("either",["open.either"],{value:9,other:1}); await digit(4);
  await digit(9); await measure("equal",["open.equal"],{value:3});
  await digit(8); await measure("invalidSum",["error.sum"]); if(collect) await inventory(p,"invalidSum");
  // Reset the state with ordinary taps, then check a complement.
  await digit(8); await digit(8); await measure("ten",["open.ten"],{value:6,other:4});
  await digit(8);
  await p.locator("#hint").click();
  await measure("hint",["hint.ten","hint.vertical"],{a:6,b:4});
  await move(8,17); if (collect) await inventory(p,"afterPair");
  if (copy.messages["open.next"]) await measure("next",["open.next"]);
  await move(4,5);
  await measure("gap",["open.gap"]);
  await move(9,11);
  await measure("edge",["open.edge"]);
  await move(7,14); await p.locator("#win h1").waitFor();
  if(collect) {
    await inventory(p,"bookResult");
    await p.locator("#play-again").click(); await p.waitForFunction(()=>document.querySelector("#mode").textContent.includes("задача 2")); await inventory(p,"secondPuzzle");
    await p.locator("#book-top").click(); await p.locator("#continue-book").waitFor(); await inventory(p,"books");
    await p.locator("#continue-book").click();
    await p.locator("#menu").click(); await inventory(p,"menu");
    await p.locator("#calendar-open").click(); await p.locator("#today-task").waitFor(); await inventory(p,"calendar");
    await p.locator("#today-task").click(); await p.waitForFunction(()=>document.querySelector("#mode").textContent.includes("Задача дня") && !document.querySelector("dialog[open]")); await inventory(p,"daily");
  }
  await context.close();
}
(async()=>{
  const browser = await chromium.launch(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{});
  try{
    for (let i=0;i<profiles.length;i++) await run(browser,profiles[i],i===0);
    fs.writeFileSync(output,JSON.stringify({browser:browser.version(),profiles,rows:probeStates,snapshots,months},null,2)+"\n");
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
