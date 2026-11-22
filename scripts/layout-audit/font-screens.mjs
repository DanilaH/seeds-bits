// Offline Android coverage. DOM is used to measure and scroll; input is sent through ADB.
import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {createHash} from "node:crypto";
import fs from "node:fs";
import {join} from "node:path";

const app = "com.seedsbits.game.preview";
const classicOnly = process.env.FONT_CLASSIC_RESULT_ONLY === "1";
const output = classicOnly ? "test-results/system-font-classic" : "test-results/system-font-android";
const prefs = `/data/user/0/${app}/shared_prefs/CapacitorStorage.xml`;
const settingsKey = "seeds-bits.settings.v1";
const progressKey = "seeds-bits.progress.v2";
const adb = (...args) => execFileSync("adb", args, {encoding:"utf8", timeout:25000}).trim();
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const stop = () => adb("shell", "am", "force-stop", app);
const launch = () => adb("shell", "am", "start", "-W", "-n", app + "/.MainActivity");
const book = JSON.parse(fs.readFileSync("src/notebook.json", "utf8"));
const isoDay = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
const snap = (board, moves = 0) => ({board, scroll:0, moves, additions:0});
const cases = {
  narrow: ["640x1136", "640x1232"],
  wide: ["736x1136", "780x1688", "876x1688"],
};
const sizes = cases[process.env.FONT_SHARD];
assert(sizes, "Select a FONT_SHARD (narrow or wide)");
fs.mkdirSync(output, {recursive:true});

function screenshot(path) {
  fs.writeFileSync(path, execFileSync("adb", ["exec-out","screencap","-p"], {timeout:10000}));
}

function setProfile({active = "classic", board = [5,5,1,1], history = [], done = [], settings = {}, meta} = {}) {
  stop();
  const entries = {
    [settingsKey]: {tutorialDone:true, sound:false, vibration:false, languageChoice:"ru", ...settings},
    [progressKey]: {version:3, active, sessions:{[active]:{rules:1,current:snap(board, history.length),history}},
      hints:{}, seen:[], done, ...(meta ? {meta} : {})},
  };
  // The test app already created this file. Overwrite in place while stopped to keep owner and label.
  const escape = s => s.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
  // Prevent Android from restoring a previous fixture if it was stopped during a write.
  adb("shell", `if [ ! -f ${prefs} ] && [ -f ${prefs}.bak ]; then mv ${prefs}.bak ${prefs}; fi`);
  let xml = adb("shell", "cat", prefs);
  xml = xml.replace(/<string name="seeds-bits\.progress\.v2\.(?:recovery|damaged)">[\s\S]*?<\/string>/g, "");
  for (const [key, value] of Object.entries(entries)) {
    const pattern = new RegExp(`<string name="${key.replaceAll(".","\\.")}">[\\s\\S]*?</string>`);
    const tag = `<string name="${key}">${escape(JSON.stringify(value))}</string>`;
    xml = pattern.test(xml) ? xml.replace(pattern, () => tag) : xml.replace("</map>", tag+"</map>");
  }
  const fixture = join(output, "fixture.xml");
  fs.writeFileSync(fixture, xml);
  adb("push", fixture, "/data/local/tmp/seeds-font-fixture.xml");
  adb("shell", `cat /data/local/tmp/seeds-font-fixture.xml > ${prefs}`);
  adb("shell", "rm", "-f", prefs + ".bak");
  fs.unlinkSync(fixture);
}

async function attach() {
  let target;
  for (let i = 0; i < 50; i++) {
    try {
      adb("forward", "tcp:9223", "localabstract:webview_devtools_remote_" + adb("shell", "pidof", app));
      target = (await (await fetch("http://127.0.0.1:9223/json/list")).json()).find(t => t.type === "page");
      if (target) break;
    } catch {}
    await wait(250);
  }
  assert(target, "Missing WebView debug target");
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {socket.onopen = resolve; socket.onerror = reject;});
  const pending = new Map();
  let id = 0;
  socket.onmessage = ({data}) => {
    const response = JSON.parse(data);
    pending.get(response.id)?.(response);
  };
  async function evaluate(expression) {
    const call = ++id;
    const response = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {pending.delete(call); reject(Error("CDP evaluation timed out"));}, 12000);
      pending.set(call, value => {clearTimeout(timeout); pending.delete(call); resolve(value);});
      socket.send(JSON.stringify({id:call, method:"Runtime.evaluate", params:{expression,returnByValue:true,awaitPromise:true}}));
    });
    assert(!response.error && !response.result.exceptionDetails, JSON.stringify(response));
    return response.result.result.value;
  }
  async function until(expression) {
    for (let i = 0; i < 50; i++) {
      if (await evaluate(expression)) return;
      await wait(150);
    }
    throw Error("Timed out: " + expression);
  }
  await until("document.querySelector('#dialog') && !document.querySelector('#app').inert");
  let box;
  for (let i = 0; i < 4; i++) {
    try {
      adb("shell", "uiautomator", "dump", "/sdcard/seeds-font.xml");
      const tree = adb("shell", "cat", "/sdcard/seeds-font.xml");
      box = /class="android\.webkit\.WebView"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/.exec(tree)?.slice(1).map(Number);
      if (box) break;
    } catch {}
  }
  assert(box, "Missing WebView screen bounds");
  const visible = selector => `(() => {
    const el=document.querySelector(${JSON.stringify(selector)});
    return el && !el.hidden && el.getClientRects().length && getComputedStyle(el).visibility==='visible';
  })()`;
  const shown = selector => until(visible(selector));
  const hidden = selector => until(`!${visible(selector)}`);
  const text = selector => evaluate(`document.querySelector(${JSON.stringify(selector)})?.textContent`);
  async function tap(selector, {scroll = true} = {}) {
    await shown(selector);
    const point = await evaluate(`(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      const find = () => {
        const r = el.getBoundingClientRect(), x = r.x+r.width/2, y = r.y+r.height/2;
        return {x,y,w:innerWidth,h:innerHeight,ok:el.contains(document.elementFromPoint(x,y)), rect:r.toJSON()};
      };
      if (${scroll} && !find().ok) el.scrollIntoView({block:"center",inline:"nearest",behavior:"instant"});
      return find();
    })()`);
    assert(point.ok, `Unreachable ${selector} ${JSON.stringify(point)}`);
    adb("shell","input","tap",String(Math.round(box[0]+point.x*(box[2]-box[0])/point.w)),String(Math.round(box[1]+point.y*(box[3]-box[1])/point.h)));
    await wait(170);
  }
  const digit = (i, options) => tap(`#board [data-index="${i}"]`, options);
  async function move(a,b, options) {
    const before = Number(await text("#remaining"));
    await digit(a, options);
    await digit(b, options);
    await until(`document.querySelector('#remaining').textContent === '${before-2}'`);
  }
  return {evaluate,until,shown,hidden,text,tap,digit,move,close:()=>socket.close()};
}

const rows = [], failures = [];
let dir, ui, current, size, font;
async function checkpoint(name, {picture = font === 2, command, within} = {}) {
  current = name;
  const state = await ui.evaluate(`(() => {
    const scope = document.querySelector('dialog[open]:last-of-type') || document.querySelector('dialog[open]') || document.querySelector('.game');
    const count = document.querySelector('#remaining')?.textContent;
    const v = document.querySelector('#viewport').getBoundingClientRect();
    const coveredCells = scope.matches(".game") ? [...scope.querySelectorAll("#board button")].filter(e => {
      const b=e.getBoundingClientRect(),x=b.x+b.width/2,y=b.y+b.height/2;
      return e.textContent.trim() && x>=v.left && x<v.right && y>=Math.max(0,v.top) && y<Math.min(innerHeight,v.bottom) &&
        !e.contains(document.elementFromPoint(x,y));
    }).map(e=>e.dataset.index) : [];
    const selectors = "button,summary,h1,h2,h3,p,label,select,strong,.action-label";
    const issues = [...scope.querySelectorAll(selectors)].filter(e => {
      const r=e.getBoundingClientRect();
      return r.width && r.height && e.textContent.trim() && !e.closest("#board") &&
        (e.scrollWidth > e.clientWidth+2 || r.left < -2 || r.right > innerWidth+2);
    }).map(e => ({name:e.id||e.className||e.tagName,text:e.textContent.trim().slice(0,80),client:e.clientWidth,scroll:e.scrollWidth}));
    return {screen:[innerWidth,innerHeight], dialog:document.querySelector('#dialog').dataset.screen,
      count, issues, coveredCells, mode:document.querySelector('#mode').textContent};
  })()`);
  rows.push({size,font,name,...state});
  if (picture) screenshot(join(dir, name + ".png"));
  if (command) {
    const readable = await ui.evaluate(`(() => {
      const e=document.querySelector(${JSON.stringify(command)}), c=document.querySelector(${JSON.stringify(within)});
      const range=document.createRange();range.selectNodeContents(e);
      const r=c.getBoundingClientRect(),lines=[...range.getClientRects()];
      return lines.length > 0 && lines.every(l=>l.top>=Math.max(0,r.top)-1 && l.bottom<=Math.min(innerHeight,r.bottom)+1 &&
        l.left>=0 && l.right<=innerWidth+1);
    })()`);
    assert(readable, command + " clipped at first paint");
  }
}

async function runSection(section, fixture, route) {
  current = section;
  try {
    ui?.close();
    if (fixture) {
      setProfile(fixture);
      launch();
    }
    ui = await attach();
    await route();
  } catch (error) {
    const row = {size,font,section,state:current,error:String(error)};
    failures.push(row);
    console.error("FONT_CASE_FAILED", JSON.stringify(row));
    try {screenshot(join(dir, "failed-" + section + ".png"));} catch {}
  } finally {
    ui?.close();
    ui = undefined;
  }
}

async function opening() {
  await ui.shown(".opening-copy");
  const field = () => ui.evaluate("document.querySelector('#viewport').getBoundingClientRect().toJSON()");
  await checkpoint("first-start", {command:".opening-copy",within:"#page-progress"});
  if (await ui.evaluate("document.documentElement.lang !== 'ru'")) {
    await ui.tap("#menu");
    await ui.tap("#pause-language");
    await ui.tap('#language-options button[data-language="ru"]');
    await ui.until("document.documentElement.lang === 'ru'");
    await ui.tap("#language-close");
    await ui.tap("#resume");
  }
  const start = await field();
  await ui.digit(4, {scroll:false});
  await checkpoint("first-two-partners", {command:".opening-copy",within:"#page-progress"});
  await ui.digit(4);
  await ui.move(8,17);
  await ui.move(4,5);
  assert.match(await ui.text(".opening-copy"), /Пустые клетки/);
  await checkpoint("first-gap", {command:".opening-copy",within:"#page-progress"});
  await ui.move(9,11);
  assert.match(await ui.text(".opening-copy"), /края/);
  await checkpoint("first-edge", {command:".opening-copy",within:"#page-progress"});
  assert.deepEqual(await field(), start, "First-task field moved with the explanation");
  await ui.move(14,7);
  await ui.shown("#win");
  assert.match(await ui.text("#win"), /1 из 24/);
  await checkpoint("first-win");
  await ui.tap("#play-again");
  await ui.until("document.querySelector('#mode').textContent.includes('задача 2')");
  await ui.tap("#menu");
  await checkpoint("pause-menu");
  await ui.tap("#close", {scroll:false});
  await ui.hidden("#dialog");
}

async function courses() {
  const steps = [[0,1],[0,1],[0,3],[0,20],[8,9]];
  const lesson = async (prefix, count) => {
    for (let i=0;i<count;i++) {
      await checkpoint(`${prefix}-${i+1}`, {command:"#lesson-text",within:"#lesson"});
      const top = await ui.evaluate("document.querySelector('#viewport').getBoundingClientRect().top");
      const [a,b] = steps[i];
      await ui.digit(a);
      await ui.digit(b);
      await ui.shown("#lesson-next");
      assert(Math.abs((await ui.evaluate("document.querySelector('#viewport').getBoundingClientRect().top"))-top)<=1,
        "Lesson field jumped after the pair");
      await ui.tap("#lesson-next");
    }
  };
  await lesson("short-lesson",2);
  await ui.tap("#menu");
  await ui.tap("#learn");
  await lesson("full-lesson",5);
  await checkpoint("full-lesson-6", {command:"#lesson-text",within:"#lesson"});
  await ui.tap("#add");
  await ui.tap("#undo");
  await ui.tap("#lesson-next");
  await ui.hidden("#lesson");
}

async function navigation() {
  await checkpoint("root-menu");
  await ui.tap("#settings-open");
  await checkpoint("settings");
  await ui.tap("#dark");
  await checkpoint("dark-settings");
  if (await ui.evaluate("!document.querySelector('#reminder-settings').hidden")) {
    await checkpoint("reminder-settings");
    const request = "#notification-permission-request:not([hidden])";
    if (await ui.evaluate(`!!document.querySelector(${JSON.stringify(request)})`)) {
      await ui.tap(request);
      let deny;
      for (let i=0;i<4 && !deny;i++) {
        try {
          adb("shell","uiautomator","dump","/sdcard/seeds-notifications.xml");
          deny = /resource-id="[^"]*:id\/permission_deny_button"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/.exec(
            adb("shell","cat","/sdcard/seeds-notifications.xml"),
          )?.slice(1).map(Number);
        } catch {}
        if (!deny) await wait(250);
      }
      assert(deny, "Android notification permission dialog did not open");
      if (font === 2) screenshot(join(dir,"notification-permission.png"));
      adb("shell","input","tap",String(Math.round((deny[0]+deny[2])/2)),String(Math.round((deny[1]+deny[3])/2)));
      await ui.until("!document.querySelector('#reminders').checked");
      await ui.shown("#notification-system-settings");
      await checkpoint("notification-denied");
    }
  }
  await ui.tap("#privacy-open");
  await checkpoint("privacy");
  // The two external links must be reachable within the app. Do not follow network links offline.
  for (const i of [1,2]) {
    const target = `#collection p:has(a):nth-last-child(${3-i}) a`;
    assert(await ui.evaluate(`(() => {
      const el=document.querySelector(${JSON.stringify(target)});
      el.scrollIntoView({block:'center',behavior:'instant'});
      const r=el.getBoundingClientRect();
      return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));
    })()`), "Privacy link unreachable");
  }
  await ui.tap("#privacy-back", {scroll:false});
  await ui.tap("#settings-back", {scroll:false});
  await ui.tap("#progress-open");
  await checkpoint("progress");
  await ui.tap("#progress-trophies");
  await checkpoint("jar-collection");
  await ui.tap("#trophies-mode");
  await checkpoint("trophies");
  await ui.tap(".trophy[data-month] .medal-figure");
  await ui.until("document.querySelector('#dialog').dataset.screen === 'calendar'");
  await checkpoint("archive-calendar");
  await ui.tap("#calendar-picker summary");
  await checkpoint("month-picker");
  await ui.tap("#calendar-picker summary");
  await ui.tap('.calendar [data-game]:not([disabled]):not(.today)');
  await ui.until("document.querySelector('#mode').textContent.includes('архива')");
  await checkpoint("archived-board");
  await ui.tap("#menu");
  await ui.tap("#daily-mode");
  await ui.until("document.querySelector('#mode').textContent.includes('Задача дня')");
  await checkpoint("today-board");
  await ui.tap("#menu");
  await ui.tap("#book-mode");
  await checkpoint("book-catalog");
  await ui.tap("#continue-book");
  await ui.until("document.querySelector('#mode').textContent.includes('задача')");
  await checkpoint("notebook-board");
}

async function classic() {
  await ui.tap("#resume");
  await checkpoint("classic-board");
  await ui.move(0,1);
  await checkpoint("classic-no-pairs");
  assert.equal(await ui.text("#status"),"Пар нет. Нажмите «Добавить» — в конец поля скопируются 2 цифры.");
  assert.deepEqual(rows.at(-1).coveredCells,[]);
  await ui.tap("#add");
  await ui.until("document.querySelector('#remaining').textContent === '4'");
  await checkpoint("classic-after-add");
  await ui.tap("#undo");
  await ui.until("document.querySelector('#remaining').textContent === '2'");
  await ui.tap("#menu");
  await ui.tap("#new");
  await checkpoint("restart-confirm");
  await ui.tap("#cancel-new");
  await ui.tap("#close");
  await ui.tap("#undo");
  await ui.until("document.querySelector('#remaining').textContent === '4'");
}

async function longHint() {
  await ui.tap("#resume");
  await ui.tap("#hint");
  await ui.shown("#hint-jump");
  await checkpoint("distant-hint");
  await ui.tap("#hint-jump");
  await ui.hidden("#hint-jump");
  await ui.digit(171);
  await ui.shown("#hint-jump");
  await checkpoint("distant-hint-back");
  await ui.tap("#hint-jump");
  await ui.digit(0);
  await ui.until("document.querySelector('#remaining').textContent === '160'");
}

async function saveError() {
  await ui.tap("#resume");
  await ui.until("document.querySelector('#remaining').textContent === '90'");
  await ui.evaluate(`(() => {
    const native=window.Capacitor.nativePromise;
    window.failAuditSave=true;
    window.Capacitor.nativePromise=(plugin,method,options)=>
      plugin==="SeedsMonetization" && method==="persistState" && window.failAuditSave
        ? Promise.reject(new Error("Offline QA: injected storage failure"))
        : native(plugin,method,options);
    document.querySelector("#retry-save").addEventListener("click",()=>window.failAuditSave=false,{once:true,capture:true});
  })()`);
  await ui.digit(0);
  await ui.digit(1);
  await ui.shown("#save-notice");
  await checkpoint("save-error");
  await ui.tap("#retry-save");
  await ui.hidden("#save-notice");
  await ui.until("document.querySelector('#remaining').textContent === '88'");
}

async function hintOffer() {
  await ui.tap("#resume");
  await ui.tap("#hint");
  await ui.shown("#hint-offer");
  await checkpoint("hint-offer-offline");
  await ui.tap("#close-hints");
  await ui.hidden("#hint-offer");
}

function trappedNotebook() {
  const history=[];
  let board=book[3].board;
  for (const [a,b] of [[1,11],[7,16],[10,13]]) {
    history.push(snap(board,history.length));
    const next=board.map((x,i)=>i===a||i===b?0:x);
    board=next.filter((_,i)=>next.slice(Math.floor(i/9)*9,Math.floor(i/9)*9+9).some(Boolean));
  }
  return {active:book[3].id,board,history};
}

async function recoverNotebook() {
  await ui.tap("#resume");
  const hintCount = await ui.text("#hint-count");
  await ui.tap("#hint");
  await ui.shown("#recover-task");
  assert.equal(await ui.text("#recover-task"),"Отменить 1 ход");
  await checkpoint("notebook-recovery");
  await ui.tap("#recover-task");
  await ui.hidden("#recover-task");
  assert.equal(await ui.text("#remaining"),"6");
  assert.equal(await ui.text("#hint-count"),hintCount);
  assert(await ui.evaluate("!document.querySelector('#hint-offer').open && !document.querySelector('#board .hinted')"));
}

async function classicNotebook() {
  await ui.tap("#resume");
  await ui.move(0,1);
  await ui.shown("#try-notebook");
  assert.equal(await ui.text("#try-notebook"),"Открыть тетрадь");
  await checkpoint("classic-open-notebook");
  await ui.tap("#try-notebook");
  await ui.until("document.querySelector('#mode').textContent === 'Тетрадь 1 · задача 3'");
}

async function checkRouteExamples() {
  const boardOf = entries => Array.from({length:Math.max(...Object.keys(entries).map(Number))+1},(_,i)=>entries[i]??0);
  for (const [name, ends, occupiedBetween] of [
    ["diagonal-down-right",[0,30],[10,20]],
    ["diagonal-down-left",[7,31],[15,23]],
    ["edge",[7,10],[8,9]],
  ]) {
    for (const reverse of [false,true]) {
      const [a,b] = reverse ? [...ends].reverse() : ends;
      const tag = `${name}-${reverse?"reverse":"forward"}`;
      const edge = name === "edge";
      const pair = {[a]:edge?6:3,[b]:edge?4:3};
      const blocked = boardOf({...pair,[occupiedBetween[0]]:8,[occupiedBetween[1]]:2});
      await runSection(`blocked-${tag}`,{board:blocked},async()=>{
        await ui.tap("#resume");
        await ui.digit(a);
        await ui.digit(b);
        const actual=await ui.evaluate("Array.from(document.querySelectorAll('.pair-blocker'),e=>Number(e.dataset.index))");
        assert.deepEqual(actual,occupiedBetween);
        await checkpoint(`blocked-${tag}`);
        assert.equal(rows.at(-1).coveredCells.length,0);
      });
      const open = boardOf(edge ? pair : {...pair,9:1,18:4});
      await runSection(`trail-${tag}`,{board:open},async()=>{
        await ui.tap("#resume");
        await ui.digit(a);
        await ui.evaluate(`new MutationObserver((_,o)=>{
          const trace=document.querySelector('#pair-trace');
          if(trace){window.qaRoute={pointerEvents:getComputedStyle(trace).pointerEvents,
            segments:[...trace.querySelectorAll('path')].map(p=>({d:p.getAttribute('d'),delay:getComputedStyle(p).animationDelay}))};o.disconnect();}
        }).observe(document.querySelector('#app'),{childList:true})`);
        await ui.digit(b);
        await ui.until(`document.querySelector('#remaining').textContent === '${edge ? 0 : 2}'`);
        const {pointerEvents,segments}=await ui.evaluate("window.qaRoute");
        assert.equal(pointerEvents,"none");
        assert.equal(segments?.length,edge?2:1);
        assert.deepEqual(segments.map(s=>s.delay),edge?["0s","0.085s"]:["0s"]);
        await ui.until(`document.querySelector('#board').getAnimations({subtree:true}).every(a=>a.playState!=='running')`);
        await checkpoint(`trail-${tag}`);
        assert.equal(rows.at(-1).coveredCells.length,0);
      });
    }
  }
}

async function result(kind) {
  await ui.tap("#resume");
  await ui.move(0,1);
  await ui.shown("#win");
  const observed = await ui.evaluate("document.querySelector('#win').dataset.resultKind");
  assert.equal(observed,kind);
  await checkpoint(`result-${kind}`);
  const headingFits = await ui.evaluate(`(() => {
    const e = document.querySelector('#win h1');
    return e.scrollWidth <= e.clientWidth + 1;
  })()`);
  assert(headingFits, "Result heading overflows");
  if (kind === "classic") {
    assert(await ui.evaluate(`Array.from(document.querySelectorAll('#result-next button')).every(
      button=>button.scrollWidth <= button.clientWidth + 1
    )`), "Classic result choice label overflows");
    await ui.until("!document.querySelector('#classic-harder').disabled");
    await ui.tap("#classic-harder");
    await ui.hidden("#win");
  } else {
    await ui.tap("#play-again");
  }
}

const commit = process.env.GITHUB_SHA;
const artifact = process.argv[2];
for (size of sizes) for (font of classicOnly ? [2] : [1,1.5,2]) {
  dir = join(output,`${size}-${font}`);
  fs.mkdirSync(dir,{recursive:true});
  stop();
  adb("shell","pm","clear",app);
  adb("shell","wm","size",size);
  adb("shell","settings","put","system","font_scale",String(font));
  assert.equal(Number(adb("shell","settings","get","system","font_scale")),font);
  launch();
  if (classicOnly) {
    const fresh = await attach();
    await fresh.shown(".opening-copy");
    fresh.close();
    await runSection("classic-result",{board:[5,5]},()=>result("classic"));
    continue;
  }
  await runSection("opening", null, opening);
  const dark = size === "640x1136" || size === "736x1136";
  await runSection("courses",{settings:{theme:dark?"dark":"light",tutorialDone:false}},courses);
  await runSection("navigation",{settings:{theme:dark?"dark":"light"}},navigation);
  await runSection("classic",{board:[5,5,1,2]},classic);
  if (font === 2) {
    const distant = Array.from({length:180},(_,i)=>i%9===0?0:1);
    distant[0]=distant[171]=5;
    await runSection("long-hint",{board:distant},longHint);
    const crowded = Array(90).fill(1);
    crowded[0]=crowded[1]=5;
    await runSection("save-error",{board:crowded},saveError);
    await runSection("hint-offer",{board:[5,5,1],meta:{version:2,wallet:0,since:isoDay,completed:0,unassisted:0,attempts:{
      classic:{id:"font-audit-exhausted",completed:false,hintKeys:["one","two","three"]},
    }}},hintOffer);
    await runSection("notebook-recovery",trappedNotebook(),recoverNotebook);
    await runSection("classic-result",{board:[5,5]},()=>result("classic"));
    await runSection("daily-result",{active:`daily-v1-${isoDay}`,board:[5,5]},()=>result("daily"));
    await runSection("page-result",{active:"book-v1-6",board:[5,5],done:book.slice(0,5).map(x=>x.id)},()=>result("page"));
    await runSection("book-result",{active:"book-v1-24",board:[5,5],done:book.slice(0,23).map(x=>x.id)},()=>result("book"));
    if (size === "640x1232" || size === "736x1136") {
      await runSection("classic-open-notebook",{board:[5,5],done:book.slice(0,2).map(x=>x.id)},classicNotebook);
      await checkRouteExamples();
    }
  }
  console.log("FONT_CASE",size,font,rows.filter(r=>r.size===size&&r.font===font).length,failures.filter(r=>r.size===size&&r.font===font).length);
}
fs.writeFileSync(join(output,"report.json"),JSON.stringify({commit,package:app,versionCode:12070,physicalPhone:false,
    webView:adb("shell","dumpsys","webviewupdate").split("\n").find(line=>line.includes("Current WebView package"))?.trim(),
    apkSha256:createHash("sha256").update(fs.readFileSync(artifact)).digest("hex"),rows,failures},null,2));
assert.equal(failures.length,0,"Check report.json and failure screenshots");
