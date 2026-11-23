import {test,expect} from "@playwright/test";
import {pairs} from "../src/core";

const key="seeds-bits.progress.v2", settings="seeds-bits.settings.v1";
const state=async(page:import("@playwright/test").Page)=>page.evaluate(
  key=>JSON.parse(localStorage.getItem(key)!),key,
);
async function menu(page:import("@playwright/test").Page,lang="ru"){
  await page.emulateMedia({reducedMotion:"reduce"});
  await page.addInitScript(({settings,lang})=>{
    localStorage.setItem(settings,JSON.stringify({tutorialDone:true,languageChoice:lang,sound:false,vibration:false}));
  },{settings,lang});
  await page.goto("/");
  await expect(page.locator("#dialog")).toHaveAttribute("open","");
}
const choice=(page:import("@playwright/test").Page,level:number)=>
  page.locator(`#classic-new-sheet [data-classic-level="${level}"]`);

test("home separates saved Continue and New Classic with three real levels",async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await menu(page);
  const before=await state(page);
  await expect(page.locator("#resume")).toBeVisible();
  await expect(page.locator("#next-classic")).toHaveText("Новая классика");
  await page.locator("#next-classic").click();
  await expect(page.locator("#classic-new-sheet")).toBeVisible();
  await page.screenshot({path:"test-results/classic-new-sheet/390x844-light.jpg",type:"jpeg",quality:88,animations:"disabled"});
  await expect(page.locator(".classic-difficulty-option")).toHaveCount(3);
  await expect(choice(page,0)).toContainText("18 цифр");
  await expect(choice(page,1)).toContainText("28 цифр");
  await expect(choice(page,2)).toContainText("27 цифр");
  await expect(page.locator("#classic-new-sheet")).toContainText("Обычная");
  const {width,height,bottom}=await page.locator("#classic-new-sheet").evaluate(e=>{
    const r=e.getBoundingClientRect();return{width:r.width,height:r.height,bottom:r.bottom};
  });
  expect(width).toBeLessThanOrEqual(390);
  // Unlike the old full-screen dialog the chooser must hug its three rows.
  expect(height).toBeGreaterThan(270);
  expect(height).toBeLessThan(470);
  expect(844-bottom).toBeLessThanOrEqual(1);
  await page.keyboard.press("Escape");
  await expect(page.locator("#classic-new-sheet")).toBeHidden();
  await expect(page.locator("#dialog")).toBeVisible();
  expect(await state(page)).toEqual(before);
  await page.locator("#resume").click();
  await expect(page.locator("#board")).toBeVisible();
});

for(const [level,count] of [[0,18],[1,28],[2,27]] as const){
  test(`fresh Classic starts ${count} numbers after one level choice ${level}`,async({page})=>{
    await menu(page);
    await page.locator("#next-classic").click();
    await choice(page,level).click();
    await expect(page.locator("#classic-new-sheet")).toBeHidden();
    await expect(page.locator("#dialog")).not.toBeVisible();
    await expect(page.locator("#remaining")).toHaveText(String(count));
    const saved=await state(page);
    expect(saved.active).toBe("classic");
    expect(saved.meta.classicRun.difficulty).toBe(level);
    expect(saved.sessions.classic.current.board.filter(Boolean)).toHaveLength(count);
    await page.locator("#menu").click();
    await expect(page.locator("#resume")).toBeVisible();
    await expect(page.locator("#home-difficulty")).toBeVisible();
  });
}

test("an unfinished Classic game is replaced only after confirmation",async({page})=>{
  await menu(page);
  await page.locator("#resume").click();
  // Choose a verified legal pair from this session, never a guessed adjacent value.
  const initial=await state(page);
  const pair=pairs(initial.sessions.classic.current.board)[0];
  expect(pair).toBeDefined();
  await page.locator(`#board button[data-index="${pair.a}"]`).click();
  await page.locator(`#board button[data-index="${pair.b}"]`).click();
  await expect(page.locator("#undo")).toBeEnabled();
  await page.locator("#menu").click();
  const original=await state(page);
  await page.locator("#next-classic").click();
  await expect(page.locator("#classic-new-help")).toContainText("подтверждения");
  await choice(page,2).click();
  await expect(page.locator("#confirm-content")).toBeVisible();
  expect((await state(page)).sessions.classic.current.board).toEqual(original.sessions.classic.current.board);
  await page.locator("#cancel-new").click();
  expect((await state(page)).sessions.classic.current.board).toEqual(original.sessions.classic.current.board);
  await page.locator("#next-classic").click();
  await choice(page,2).click();
  await page.locator("#confirm-new").click();
  await expect(page.locator("#remaining")).toHaveText("27");
  expect((await state(page)).meta.classicRun.difficulty).toBe(2);
});

test("new Classic saves an unfinished notebook; it is recoverable with Undo",async({page})=>{
  await page.addInitScript(key=>{
    const original=[0,0,7,0,0,0,0,6,3,0,0,0,1,9,0,4,7,3];
    const current=[0,0,7,0,0,0,0,6,3,0,0,0,0,0,0,4,7,3];
    const entry={rules:1,current:{board:current,moves:1,scroll:0,additions:0},
      history:[{board:original,moves:0,scroll:0,additions:0}]};
    localStorage.setItem(key,JSON.stringify({
      version:3,active:"book-v1-2",sessions:{"book-v1-2":entry},
      done:["book-v1-1"],seen:[],hints:{},
    }));
  },key);
  await menu(page);
  const before=await state(page);
  await expect(page.locator("#resume")).toContainText("задачу 2");
  await page.locator("#next-classic").click();
  await choice(page,0).click();
  await expect(page.locator("#mode")).toContainText("Классика");
  const after=await state(page);
  expect(after.active).toBe("classic");
  expect(after.sessions["book-v1-2"].current.board).toEqual(before.sessions["book-v1-2"].current.board);
  expect(after.sessions["book-v1-2"].history).toEqual(before.sessions["book-v1-2"].history);
  await page.locator("#book-top").click();
  await page.locator('[data-game="book-v1-2"]').click();
  await expect(page.locator("#mode")).toContainText("задача 2");
  await expect(page.locator("#undo")).toBeEnabled();
});

test("bottom sheet is tappable on short phones and localized in English",async({page})=>{
  await page.setViewportSize({width:320,height:568});
  await menu(page,"en");
  await page.locator("#next-classic").click();
  await page.screenshot({path:"test-results/classic-new-sheet/320x568-english.jpg",type:"jpeg",quality:88,animations:"disabled"});
  await expect(page.locator("#classic-new-title")).toHaveText("New Game");
  for(const item of await page.locator(".classic-difficulty-option").all()){
    const r=await item.boundingBox();expect(r).not.toBeNull();
    expect(r!.width).toBeGreaterThan(210);
    expect(r!.height).toBeGreaterThanOrEqual(44);
    await expect(item).toBeInViewport({ratio:0.95});
  }
  await page.locator("#classic-new-close").click();
  await expect(page.locator("#classic-new-sheet")).toBeHidden();
});
