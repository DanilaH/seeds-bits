import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
const url = pathToFileURL(path.resolve(process.argv[2] || "test-results/first-game.html")).href;
const out = path.resolve(process.argv[3] || "test-results/first-game");
await mkdir(out,{recursive:true});
const browser = await chromium.launch({executablePath:process.env.SEEDS_CHROMIUM || undefined,args:["--no-sandbox"]});
const rows=[];
try {
  for (const [width,height,scale] of [[390,844,1],[320,568,1.5],[320,568,2],[568,320,2]]) {
    const ctx=await browser.newContext({viewport:{width,height},reducedMotion:"reduce",locale:"ru-RU",timezoneId:"Asia/Yekaterinburg"});
    await ctx.setOffline(true);
    const page=await ctx.newPage();
    const errors=[];page.on("pageerror",e=>errors.push(e.message));
    await page.goto(url);
    await page.locator(".opening-copy").waitFor();
    if(scale!==1) await page.evaluate(scale=>{
      const nodes=[...document.querySelectorAll("body *")].filter(el=>el instanceof HTMLElement);
      const sizes=nodes.map(el=>getComputedStyle(el).fontSize);
      nodes.forEach((el,i)=>{el.style.fontSize=parseFloat(sizes[i])*scale+"px";});
    },scale);
    await page.waitForTimeout(130);
    const states=[];
    async function state(name, index=4) {
      const record=await page.evaluate(({name,index})=>{
        const rect=el=>el.getBoundingClientRect();
        const board=rect(document.querySelector("#board"));
        const copy=document.querySelector(".opening-copy");
        const text=rect(copy);
        const digit=document.querySelector('#board [data-index="'+index+'"]');
        const cell=rect(digit);
        const x=cell.x+cell.width/2,y=cell.y+cell.height/2;
        return {name,boardTop:board.top,cue:copy.textContent,overlap:text.bottom>board.top+1 && text.right>board.left && text.left<board.right,canTap:digit.contains(document.elementFromPoint(x,y)),pageOverflow:document.documentElement.scrollWidth>innerWidth};
      },{name,index});
      states.push(record);
      if (width===390) await page.screenshot({path:path.join(out,name+".png")});
      assert.ok(!record.overlap && !record.pageOverflow && record.canTap,JSON.stringify({width,height,scale,record}));
    }
    const tap=async i=>{await page.locator('#board [data-index="'+i+'"]').click();await page.waitForTimeout(130);};
    await state("01-start");
    await tap(4);
    await state("01-selected",4);
    await tap(8);
    await state("02-rejected",8);
    await tap(17);
    await state("03-sum",4);
    await tap(4);await tap(5);
    await tap(9);await tap(11);
    await state("04-edge",14);
    await tap(14);
    await state("05-selected-edge",7);
    const edge=await page.locator("#paths path").getAttribute("d");
    await tap(14);await tap(7);
    assert.equal(await page.locator("#paths path").getAttribute("d"),edge);
    await tap(7);await tap(14);
    await tap(7);
    await page.locator("#play-again:visible").waitFor();
    assert.equal(await page.locator("#play-again").innerText(),"К задаче 2");
    assert.match(await page.locator("#win").innerText(),/решено 1 из 24/);
    if(width===390) await page.screenshot({path:path.join(out,"06-win.png")});
    await page.locator("#play-again").click();
    await page.waitForFunction(()=>document.querySelector("#mode").textContent.endsWith("задача 2"),{},{timeout:4500});
    assert.match(await page.locator("#mode").innerText(),/задача 2/);
    await tap(12);await tap(13);
    const left=await page.locator("#remaining").innerText();
    const key="seeds-research.first-game.progress.v2";
    const previous=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).sessions["book-v1-2"].current.board,key);
    await page.reload();await page.locator("#resume:visible").waitFor();await page.locator("#resume").click();
    assert.match(await page.locator("#mode").innerText(),/задача 2/);
    assert.equal(await page.locator("#remaining").innerText(),left);
    const resumed=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).sessions["book-v1-2"].current.board,key);
    assert.deepEqual(resumed,previous);
    assert.equal(await page.locator(".opening-copy").count(),0);
    if(width===390) {
      await page.locator("#menu").click();
      await page.locator("#daily-mode").click();
      await page.waitForFunction(()=>document.querySelector("#mode").textContent.startsWith("Задача дня"));
      await page.locator("#menu").click();
      await page.locator("#classic-mode").click();
      await page.waitForFunction(()=>document.querySelector("#mode").textContent==="Классика");
      await page.locator("#menu").click();
      await page.locator("#book-mode").click();
      await page.locator("#continue-book").click();
      await page.waitForFunction(()=>document.querySelector("#mode").textContent.endsWith("задача 2"));
      assert.equal(await page.locator("#remaining").innerText(),left);
    }
    assert.deepEqual(errors,[]);
    const drift=Math.max(...states.map(s=>s.boardTop))-Math.min(...states.map(s=>s.boardTop));
    assert.ok(drift<=1,JSON.stringify({width,height,scale,drift,states}));
    rows.push({width,height,textScale:scale,drift,states,reverseEdge:edge,result:"1/24",next:"book-v1-2",resumeSameBoard:true});
    await ctx.close();
  }
  const legacy=await browser.newContext({viewport:{width:390,height:844}});
  await legacy.addInitScript(()=>{
    localStorage.setItem("seeds-research.first-game.settings.v1",JSON.stringify({tutorialDone:true,sound:true}));
  });
  const oldPage=await legacy.newPage();
  await oldPage.goto(url);
  await oldPage.locator("#resume:visible").waitFor();
  assert.equal(await oldPage.locator(".opening-copy").count(),0);
  assert.ok(!(await oldPage.evaluate(()=>JSON.stringify(localStorage))).includes("first-game-research-v1"));
  await legacy.close();
  await writeFile(path.join(out,"checked.json"),JSON.stringify(rows,null,2)+"\n");
  console.log(rows.map(x=>[x.width,x.height,x.textScale,x.drift]));
} finally {await browser.close();}
