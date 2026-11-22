import {test, expect, type Page} from "@playwright/test";
import notebook from "../src/notebook.json" with {type:"json"};
import {pairs, removePair} from "../src/core";

const progressKey = "seeds-bits.progress.v2";
const settingsKey = "seeds-bits.settings.v1";
const original = notebook[1].board;
const firstPair = pairs(original)[0];
const current = removePair(original, firstPair.a, firstPair.b);
const snap = (board: number[], moves: number) => ({board, moves, additions:0, scroll:0});
const task2Session = {
  rules:1,
  current:snap(current,1),
  history:[snap(original,0)],
};

async function seeded(page:Page, options:{active?:string; done?:string[]; seeds?:number; language?:string}={}) {
  const active=options.active??"book-v1-2", done=options.done??["book-v1-1"], seeds=options.seeds??4;
  await page.addInitScript(({progressKey,settingsKey,active,done,seeds,language,task2Session}) => {
    localStorage.setItem(settingsKey,JSON.stringify({tutorialDone:true,languageChoice:language??"ru",sound:false,vibration:false}));
    localStorage.setItem(progressKey,JSON.stringify({
      version:3, active, done, seen:[], hints:{},
      sessions:{[active]:active==="book-v1-2"?task2Session:{rules:1,current:{board:[5,5],moves:0,additions:0,scroll:0},history:[]}},
      jars:{version:2,seeds,meter:seeds,wins:0,attempt:"followup-fixture",highWater:0},
    }));
  }, {progressKey,settingsKey,active,done,seeds,language:options.language,task2Session});
  await page.goto("/");
  await expect(page.locator("#dialog")).toHaveAttribute("open","");
}
const boardTop=async (page:Page) => (await page.locator("#viewport").boundingBox())!.y;

test("progress card targets its own saved notebook after New and Completed catalog filters",async({page})=>{
  await page.emulateMedia({reducedMotion:"reduce"});
  await seeded(page);
  for(const filter of ["new","done"]) {
    await page.locator("#book-mode").click();
    await page.locator("#other-books summary").click();
    await page.locator("#book-filter").selectOption(filter);
    await expect(page.locator("#book-filter")).toHaveValue(filter);
    await page.locator("#collection-back").click();
    await page.locator("#progress-open").click();
    const card=page.locator("#progress-book");
    await expect(card).toHaveAttribute("data-volume","0");
    await expect(card).toContainText("Тетрадь 1");
    await card.click();
    await expect(page.locator(".volume-heading h3")).toHaveText("Тетрадь 1");
    await expect(page.locator(".volume-heading")).toContainText("1 из 24");
    await expect(page.locator("#book-filter")).toHaveValue("all");
    await expect(page.locator("#continue-book")).toHaveAttribute("data-continue","book-v1-2");
    await page.screenshot({path:`test-results/calm-followup/progress-${filter}-390x844.jpg`,type:"jpeg",quality:88,animations:"disabled"});
    await page.locator("#continue-book").click();
    await expect(page.locator("#mode")).toHaveText("Тетрадь 1 · задача 2");
    await expect(page.locator("#undo")).toBeEnabled();
    expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).active,progressKey)).toBe("book-v1-2");
    await page.locator("#menu").click();
  }
});

test("pause menu has a 50-70px card gap at 390x844 with footer near bottom",async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await seeded(page);
  await page.screenshot({path:"test-results/calm-followup/menu-390x844.jpg",type:"jpeg",quality:90,animations:"disabled"});
  const measure=await page.evaluate(()=>{
    const a=document.querySelector(".home-current")!.getBoundingClientRect();
    const b=document.querySelector("#classic-mode")!.getBoundingClientRect();
    const links=document.querySelector(".home-links")!.getBoundingClientRect();
    const qa=document.querySelector("#qa-profile")?.getBoundingClientRect();
    return {gap:b.top-a.bottom, linksBottom:links.bottom, qaBottom:qa?.bottom??links.bottom, screen:innerHeight};
  });
  expect(measure.gap).toBeGreaterThanOrEqual(50);
  expect(measure.gap).toBeLessThanOrEqual(70);
  expect(measure.screen-measure.qaBottom).toBeGreaterThanOrEqual(0);
  expect(measure.screen-measure.qaBottom).toBeLessThanOrEqual(45);
});

test("full course uses one action plus one rule; answering does not shift board",async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await seeded(page);
  await page.locator("#learn").click();
  const moves:[[number,number],[number,number],[number,number],[number,number],[number,number]]=[
    [0,1],[0,1],[0,3],[0,20],[8,9],
  ];
  const commands=[
    "Нажмите на две четвёрки.","Соедините 3 и 7.","Соедините две двойки.","Соедините 8 и 2.","Соедините 6 и 4.",
  ];
  const rules=[
    "Одинаковые цифры образуют пару.","Цифры с суммой 10 тоже образуют пару.",
    "Пустые клетки между цифрами можно пропускать.","Соединять пары можно и по диагонали.",
    "Конец строки продолжается в начале следующей.",
  ];
  for(let i=0;i<moves.length;i++){
    await expect(page.locator("#lesson-text")).toHaveText(commands[i]);
    await expect(page.locator("#lesson-detail")).toHaveText(rules[i]);
    await expect(page.locator("#lesson-feedback")).toBeEmpty();
    const y=await boardTop(page);
    if(i===2) await page.screenshot({path:"test-results/calm-followup/lesson-3-390x844.jpg",type:"jpeg",quality:90,animations:"disabled"});
    for(const n of moves[i]) await page.locator(`#board button[data-index="${n}"]`).click();
    await expect(page.locator("#lesson-next")).toBeVisible();
    await expect(page.locator("#lesson-feedback")).toHaveText("Верно! Ход принят.");
    expect(Math.abs((await boardTop(page))-y)).toBeLessThanOrEqual(1);
    await page.locator("#lesson-next").click();
    expect(Math.abs((await boardTop(page))-y)).toBeLessThanOrEqual(1);
  }
  await expect(page.locator("#lesson-text")).toHaveText("Нажмите «Добавить», затем «Отмена».");
  await expect(page.locator("#lesson-detail")).toHaveText("«Добавить» копирует цифры, «Отмена» возвращает поле.");
  await page.locator("#add").click();
  await page.locator("#undo").click();
  await expect(page.locator("#lesson-next")).toBeVisible();
});

test("short course has a single instruction and rule in both steps",async({page})=>{
  await page.addInitScript(key=>localStorage.setItem(key,JSON.stringify({tutorialDone:false,languageChoice:"ru"})),settingsKey);
  await page.goto("/");
  await expect(page.locator("#lesson-text")).toHaveText("Нажмите на две четвёрки.");
  await expect(page.locator("#lesson-detail")).toHaveText("Одинаковые цифры образуют пару.");
  await expect(page.locator("#lesson-feedback")).toBeEmpty();
  for(const n of [0,1])await page.locator(`#board button[data-index="${n}"]`).click();
  await page.locator("#lesson-next").click();
  await expect(page.locator("#lesson-text")).toHaveText("Соедините 3 и 7.");
  await expect(page.locator("#lesson-detail")).toHaveText("Цифры с суммой 10 тоже образуют пару.");
});

for(const language of ["en","es","tr","pt-BR"]) {
  test(`all six lesson rules translate without repeating the command: ${language}`,async({page})=>{
    await seeded(page,{language});
    await page.locator("#learn").click();
    const steps:[[number,number],[number,number],[number,number],[number,number],[number,number]]=[
      [0,1],[0,1],[0,3],[0,20],[8,9],
    ];
    for(let i=0;i<steps.length;i++){
      const text=await page.locator("#lesson-text").innerText();
      const rule=await page.locator("#lesson-detail").innerText();
      expect(text.length).toBeGreaterThan(3);
      expect(rule.length).toBeGreaterThan(12);
      expect(text).not.toBe(rule);
      for(const n of steps[i])await page.locator(`#board button[data-index="${n}"]`).click();
      await expect(page.locator("#lesson-next")).toBeVisible();
      await page.locator("#lesson-next").click();
    }
    await expect(page.locator("#lesson-detail")).not.toBeEmpty();
  });
}

test("same-day archive leaves the year out; previous-year archive shows the year on board and pause",async({page})=>{
  await page.clock.setFixedTime(new Date("2026-11-22T12:00:00+05:00"));
  await seeded(page,{active:"daily-v1-2025-11-13"});
  await page.locator("#resume").click();
  await expect(page.locator("#mode")).toContainText("2025");
  await page.locator("#menu").click();
  await expect(page.locator("#home-game-title")).toContainText("2025");
  await expect(page.locator("#resume-context")).toContainText("2025");
  await expect(page.locator("#resume")).toContainText("2025");
  await page.locator("#resume").click();
  expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).active,progressKey)).toBe("daily-v1-2025-11-13");
});

for(const n of [0,6,7,13,14,30]){
  test(`month trophy reflects nearest milestone with ${n} completed days`,async({page})=>{
    await page.clock.setFixedTime(new Date("2026-11-22T12:00:00+05:00"));
    const done=Array.from({length:n},(_,i)=>`daily-v1-2026-11-${String(i+1).padStart(2,"0")}`);
    await seeded(page,{done});
    await page.locator("#progress-open").click();
    await page.locator("#progress-trophies").click();
    await page.locator("#trophies-mode").click();
    const hero=page.locator(".month-hero");
    await expect(hero).toContainText(`${n} из 30`);
    if(n===0)await expect(hero.locator(".metal-goal")).toHaveText("До бронзы — 7 дней");
    if(n===6)await expect(hero.locator(".metal-goal")).toHaveText("До бронзы — 1 день");
    if(n===13)await expect(hero.locator(".metal-goal")).toHaveText("До серебра — 1 день");
    if(n===7||n===14||n===30) await expect(hero.locator(".trophy-mark")).toHaveClass(/earned/);
    else await expect(hero.locator(".trophy-mark")).not.toHaveClass(/earned/);
  });
}

for(const n of [1,2,4,5,11,21]){
  test(`collection pluralizes ${n} seeds and shows distinct shapes`,async({page})=>{
    await seeded(page,{seeds:n});
    await page.locator("#progress-open").click();
    await page.locator("#progress-trophies").click();
    await expect(page.locator(".jar-collected-count")).toContainText(
      `${n} ${n%10===1&&n%100!==11?"семечко":n%10>=2&&n%10<=4&&(n%100<12||n%100>14)?"семечка":"семечек"}`,
    );
    await expect(page.locator(".jar-overview .jar-grains i")).toHaveCount(n);
  });
}
