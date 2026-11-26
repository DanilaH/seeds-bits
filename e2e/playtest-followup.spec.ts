import {expect,test,type Page} from "@playwright/test";

async function seed(page:Page,kind:string,lang="ru",completedDays=0) {
  await page.addInitScript(({kind,lang,completedDays})=>{
    if(localStorage.getItem("seeds-bits.progress.v2")) return;
    const id=kind==="book"?"book-v1-24":kind==="daily"?"daily-v1-2026-11-13":kind==="dead"?"book-v1-25":"classic";
    const board=kind==="dead"?[1,2,3,4]:[5,5];
    localStorage.setItem("seeds-bits.settings.v1",JSON.stringify({tutorialDone:true,languageChoice:lang,sound:false}));
    localStorage.setItem("seeds-bits.progress.v2",JSON.stringify({version:3,active:id,sessions:{[id]:{rules:1,current:{board,moves:1,additions:0,scroll:0},history:[]}},seen:[],done:kind==="book"?Array.from({length:23},(_,i)=>"book-v1-"+(i+1)):kind==="daily"?Array.from({length:30},(_,i)=>i+1).filter(day=>day!==13).slice(0,completedDays).map(day=>"daily-v1-2026-11-"+String(day).padStart(2,"0")):[],hints:{}}));
  },{kind,lang,completedDays});
  await page.goto("/");
  await page.evaluate(()=>document.documentElement.classList.add("has-mobile-ads"));
  await page.locator("#resume").click();
}
for(const width of [320,390])for(const kind of ["classic","book","daily"])for(const lang of ["ru","en","pt-BR"]) {
  test(`result fits without scrolling ${kind} ${lang} ${width}`,async({page})=>{
    await page.setViewportSize({width,height:width===320?568:844});
    await seed(page,kind,lang);
    await page.locator('[data-index="0"]').click();
    await page.locator('[data-index="1"]').click();
    await expect(page.locator("#win")).toBeVisible();
    await page.locator("#win").evaluate(el=>Promise.allSettled(el.getAnimations({subtree:true}).map(a=>a.finished)));
    await page.evaluate(()=>document.fonts.ready);
    const metrics=await page.locator("#viewport").evaluate(e=>({height:e.clientHeight,content:e.scrollHeight}));
    expect(metrics.content).toBeLessThanOrEqual(metrics.height+1);
    const cropped = await page.locator("#win").evaluate(win=>{
      const view=document.getElementById("viewport")!.getBoundingClientRect();
      return [...win.querySelectorAll<HTMLElement>("h1, #result-gains, #result-jar-amount, .metal-goal, #win-stats")].filter(el=>{
        if(!el.checkVisibility()) return false;
        const box=el.getBoundingClientRect();
        return box.top < view.top-1 || box.bottom > view.bottom+1;
      }).map(el=>el.id || el.className);
    });
    expect(cropped).toEqual([]);
    await expect(page.locator("#play-again")).toBeInViewport();
    if(kind!=="book") await expect(page.locator("#result-home")).toBeInViewport();
    if(kind==="daily") {
      await expect(page.locator(".quiet-result-page #award .metal-goal")).toBeVisible();
      const medal=await page.locator("#award").boundingBox(),paper=await page.locator(".quiet-result-page").boundingBox();
      expect(medal!.y+medal!.height).toBeLessThanOrEqual(paper!.y+paper!.height+10);
    }
  });
}
test("a dead notebook shows a reachable immediate restart",async({page})=>{
  await page.setViewportSize({width:320,height:568});
  await seed(page,"dead");
  const card=page.locator("#no-moves-card");
  await expect(card).toBeVisible();
  await expect(card).toContainText("Пар больше нет");
  const box=await card.boundingBox(),field=await page.locator("#viewport").boundingBox();
  expect(box!.y+box!.height).toBeLessThanOrEqual(field!.y+field!.height);
  await page.locator("#no-moves-primary").click();
  await expect(card).toBeHidden();
  await expect(page.locator('#dialog[data-screen="confirm"]')).toBeHidden();
});
test("the daily nudge stops after entering today's game and survives reload",async({page})=>{
  await seed(page,"classic");
  await page.locator("#menu").click();
  await expect(page.locator("#daily-mode")).toHaveAttribute("data-daily-pending","");
  await expect(page.locator("#daily-mode")).not.toHaveAttribute("data-daily-started");
  await page.locator("#daily-mode").click();
  await page.locator("#menu").click();
  await expect(page.locator("#daily-mode")).toHaveAttribute("data-daily-started","");
  await page.reload();
  await expect(page.locator("#daily-mode")).toHaveAttribute("data-daily-started","");
});

test("the illustrated notebook resumes the saved board with a stationary touch target", async ({page}) => {
  await seed(page,"classic");
  await page.locator("#menu").click();
  const notebook = page.locator("#home-notebook");
  const start = (await notebook.boundingBox())!;
  await page.waitForTimeout(350);
  expect(await notebook.boundingBox()).toEqual(start);
  // Raw coordinates exercise the target while its visual child is floating.
  await page.mouse.click(start.x + start.width / 2, start.y + start.height / 2);
  await expect(page.locator("#dialog")).toBeHidden();
  await expect(page.locator("#remaining")).toHaveText("2");
});

test("empty notebook starts the difficulty choice and keyboard cancellation preserves it", async ({page}) => {
  await seed(page,"classic");
  await page.locator('[data-index="0"]').click();
  await page.locator('[data-index="1"]').click();
  await page.locator("#result-home").click();
  await expect(page.locator(".home-current")).toHaveAttribute("data-new-game", "");
  const notebook = page.locator("#home-notebook");
  await page.emulateMedia({reducedMotion:"reduce"});
  expect(await notebook.locator(".home-current-copy").evaluate(el => el.getAnimations().length)).toBe(0);
  await notebook.focus();
  await page.keyboard.down(" ");
  await page.locator("#classic-mode").focus();
  await page.keyboard.up(" ");
  await expect(page.locator("#classic-new-sheet")).toBeHidden();
  await notebook.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#classic-new-sheet")).toBeVisible();
});

for(const completedDays of [6,13,29]) for(const lang of ["ru","en","pt-BR"]) {
  test(`earned daily medal and next goal fit at 320, previous=${completedDays}, ${lang}`,async({page})=>{
    await page.setViewportSize({width:320,height:568});
    await seed(page,"daily",lang,completedDays);
    await page.locator('[data-index="0"]').click();
    await page.locator('[data-index="1"]').click();
    await expect(page.locator("#win")).toBeVisible();
    await page.locator("#win").evaluate(el=>Promise.allSettled(el.getAnimations({subtree:true}).map(a=>a.finished)));
    const frame=(await page.locator("#viewport").boundingBox())!;
    for(const selector of ["#win h1","#result-gains","#award"]) {
      const box=(await page.locator(selector).boundingBox())!;
      expect(box.y).toBeGreaterThanOrEqual(frame.y-1);
      expect(box.y+box.height).toBeLessThanOrEqual(frame.y+frame.height+1);
    }
  });
}
