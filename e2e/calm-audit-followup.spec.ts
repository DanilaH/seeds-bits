import { chooseBookVolume, exposeBookFilter } from "./book-controls";
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
    await (await exposeBookFilter(page)).selectOption(filter);
    await expect(page.locator("#book-filter")).toHaveValue(filter);
    await page.locator("#collection-back").click();
    await page.locator("#collection-back").click();
    await page.locator("#progress-open").click();
    const card=page.locator("#progress-book");
    await expect(card).toHaveAttribute("data-volume","0");
    await expect(card).toContainText("Тетрадь 1");
    await card.click();
    await expect(page.locator(".dialog-head .screen-heading h2")).toHaveText("Тетрадь 1");
    await expect(page.locator(".notebook-toolbar")).toContainText("1 из 24");
    await expect(page.locator("#continue-book")).toHaveAttribute("data-continue","book-v1-2");
    await page.screenshot({path:`test-results/calm-followup/progress-${filter}-390x844.jpg`,type:"jpeg",quality:88,animations:"disabled"});
    await page.locator("#continue-book").click();
    await expect(page.locator("#mode")).toHaveText("Тетрадь 1 · задача 2");
    await expect(page.locator("#undo")).toBeEnabled();
    expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).active,progressKey)).toBe("book-v1-2");
    await page.locator("#menu").click();
  }
});

test("pause menu has a compact card gap at 390x844 with footer near bottom",async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await seeded(page);
  await page.screenshot({path:"test-results/calm-followup/menu-390x844.jpg",type:"jpeg",quality:90,animations:"disabled"});
  const measure=await page.evaluate(()=>{
    const a=document.querySelector(".home-current")!.getBoundingClientRect();
    const b=document.querySelector("#classic-mode")!.getBoundingClientRect();
    const links=document.querySelector(".home-links")!.getBoundingClientRect();
    const qa=document.querySelector("#qa-profile");
    const qaBox=qa && qa.getClientRects().length ? qa.getBoundingClientRect() : null;
    return {gap:b.top-a.bottom, linksBottom:links.bottom, qaBottom:qaBox?.bottom??links.bottom, screen:innerHeight};
  });
  expect(measure.gap).toBeGreaterThanOrEqual(0);
  expect(measure.gap).toBeLessThanOrEqual(20);
  expect(measure.screen-measure.qaBottom).toBeGreaterThanOrEqual(0);
  expect(measure.screen-measure.qaBottom).toBeLessThanOrEqual(45);
});

test("full course uses one action plus one rule; answering does not shift board",async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await seeded(page);
  await page.locator("#learn").click();
  const field = page.locator("#viewport");
  const originalSlot = await field.boundingBox();
  const command = await page.locator("#lesson-text").boundingBox();
  expect(command!.y).toBeGreaterThanOrEqual(originalSlot!.y + originalSlot!.height);
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
    await expect(page.locator("#lesson-feedback")).toHaveText("Получилось!");
    expect(Math.abs((await boardTop(page))-y)).toBeLessThanOrEqual(1);
    await page.locator("#lesson-next").click();
    expect(Math.abs((await boardTop(page))-y)).toBeLessThanOrEqual(1);
  }
  await expect(page.locator("#lesson-text")).toHaveText("Нажмите «Добавить», затем «Отмена».");
  await expect(page.locator("#lesson-detail")).toHaveText("«Добавить» копирует цифры, «Отмена» возвращает поле.");
  await page.locator("#add").click();
  await page.locator("#undo").click();
  await expect(page.locator("#lesson-next")).toBeVisible();
  const endSlot = await field.boundingBox();
  expect(Math.abs(endSlot!.y - originalSlot!.y)).toBeLessThanOrEqual(1);
  expect(Math.abs(endSlot!.height - originalSlot!.height)).toBeLessThanOrEqual(1);
});

test("entering a lesson in landscape excludes the game hint dock on the first layout", async ({page}) => {
  await page.setViewportSize({ width: 568, height: 320 });
  await seeded(page);
  await page.locator("#resume").click();
  const dock = page.locator("#hint-dock");
  await expect(dock).not.toHaveAttribute("hidden", "");
  await page.locator("#menu").click();
  const firstLayout = await page.locator("#learn").evaluate((button: HTMLElement) => {
    button.click();
    return document.querySelector("#hint-dock")!.getBoundingClientRect().height;
  });
  expect(firstLayout).toBe(0);
  await expect(page.locator("#lesson")).toBeVisible();
});

test("field header follows the grid and the compact language rows keep their markers", async ({page}) => {
  await page.setViewportSize({width:320,height:568});
  await seeded(page);
  await page.locator("#resume").click();
  const menu = await page.locator("#menu").boundingBox();
  const board = await page.locator("#board").boundingBox();
  expect(Math.abs(menu!.x - board!.x)).toBeLessThanOrEqual(1);
  expect(menu!.width).toBeGreaterThanOrEqual(44);
  await page.locator("#menu").click();
  await page.locator("#settings-open").click();
  expect(await page.locator("#language-open").evaluate(el=>getComputedStyle(el).borderInlineStartWidth)).toBe("0px");
  await page.locator("#language-open").click();
  await expect(page.locator('#language-options [data-language="auto"] .language-mark svg')).toBeVisible();
  const flags = page.locator('#language-options button:not([data-language="auto"]) .language-mark svg');
  await expect(flags).toHaveCount(5);
  expect(await flags.evaluateAll(icons => icons.every(icon =>
    [...icon.querySelectorAll("path:not([stroke]), circle:not([stroke])")]
      .every(shape => getComputedStyle(shape).stroke === "none"),
  ))).toBe(true);
  expect(await flags.nth(1).locator("path[stroke]").first().evaluate(
    path => getComputedStyle(path).stroke,
  )).toBe("rgb(255, 255, 255)");
  await page.locator('#language-options [data-language="pt-BR"]').click();
  await expect(page.locator('#language-options [data-language="pt-BR"]')).toHaveAttribute("aria-pressed","true");
  expect(await page.locator("#language-options").evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
});

test("home mode art sits beside the labels and extends past both card edges", async ({page}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await seeded(page);
  await expect(page.locator("#book-mode .book-picture > .book-cover")).toHaveCount(1);
  await expect(page.locator("#book-mode .book-cover svg")).toHaveCount(0);
  await expect(page.locator("#book-mode .book-cover-number")).toHaveText("№1");
  await expect(page.locator("#book-count")).toHaveText("1 из 24 задач");
  await expect(page.locator("#home-current-art .book-cover-number")).toHaveText("№1");
  const dimensions = await page.evaluate(() => {
    return [["#book-mode", "#book-mode .book-picture"], [".home-calendar", "#home-today-art .calendar-picture"]]
      .map(([card, art]) => {
        const frame = document.querySelector(card)!.getBoundingClientRect();
        const artwork = document.querySelector(art)!;
        const icon = artwork.getBoundingClientRect();
        const label = artwork.closest("button")!.lastElementChild!;
        return { cardLeft: frame.left, iconLeft: icon.left, iconRight: icon.right,
          iconWidth: icon.width, labelLeft: label.getBoundingClientRect().left };
      });
  });
  for (const { cardLeft, iconLeft, iconRight, iconWidth, labelLeft } of dimensions) {
    expect(iconLeft).toBeGreaterThan(0);
    expect(iconLeft).toBeLessThan(cardLeft);
    expect(iconWidth).toBeGreaterThan(48);
    expect(iconRight).toBeLessThan(labelLeft);
  }
  const [bookInset, dayInset] = dimensions.map(({ cardLeft, labelLeft }) => labelLeft - cardLeft);
  expect(Math.abs(bookInset - dayInset)).toBeLessThanOrEqual(1);
  await expect(page.locator("#calendar-open")).toBeVisible();
});

test("the Home notebook cover shows progress for the volume it opens", async ({ page }) => {
  await seeded(page, { done: ["book-v1-1", "book-v1-25", "book-v1-26"] });
  const card = page.locator("#book-mode");
  await card.click();
  await chooseBookVolume(page,1);
  await expect(page.locator(".dialog-head .screen-heading h2")).toHaveText("Тетрадь 2");
  await expect(page.locator(".notebook-toolbar")).toContainText("2 из 24 задач");
  await page.locator("#collection-back").click();
  await page.locator("#collection-back").click();
  await page.locator("#collection-back").click();
  await expect(card.locator(".book-cover-number")).toHaveText("№1");
  await expect(card).toHaveAccessibleName(/Тетрадь 1.*задача 2/);
});

test("the three-digit recommended notebook number fits on the cover at 320px", async ({ page }) => {
  await page.setViewportSize({ width:320,height:568 });
  await seeded(page,{active:"book-v1-2377"});
  const number=page.locator("#book-mode .book-cover-number");
  await expect(number).toHaveText("№100");
  const fits=await number.evaluate(label=>label.getBoundingClientRect().width <= label.parentElement!.clientWidth);
  expect(fits).toBe(true);
});

test.describe("month on the home calendar", () => {
  test.use({ timezoneId: "America/Los_Angeles" });

  test("tracks the game language and rolls over to the next month", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.clock.setFixedTime(new Date("2026-11-30T20:00:00Z"));
    await seeded(page);
    const calendar = page.locator("#home-today-art .calendar-picture");
    const day = calendar.locator("span").first();
    const month = calendar.locator(".calendar-picture-month");
    await expect(day).toHaveText("30");
    await expect(month).toHaveText("нояб.");

    await page.locator("#pause-language").click();
    await page.locator('#language-options [data-language="en"]').click();
    await page.locator("#language-close").click();
    await expect(month).toHaveText("Nov");

    await page.clock.setFixedTime(new Date("2026-12-01T20:00:00Z"));
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(day).toHaveText("1");
    await expect(month).toHaveText("Dec");
  });
});

test("today is emphasized until its puzzle is completed", async ({page}) => {
  await page.clock.setFixedTime(new Date("2026-11-23T12:00:00+05:00"));
  const id = "daily-v1-2026-11-23";
  await seeded(page,{active:id,done:["daily-v1-2026-11-22"]});
  const daily = page.locator("#daily-mode");
  const icon = daily.locator("#home-today-art");
  const calendar = icon.locator(".calendar-picture");
  await expect(daily).toHaveAttribute("data-daily-pending","");
  expect(await icon.evaluate(el=>getComputedStyle(el,"::after").content)).toBe("none");
  await expect(calendar).toHaveCSS("animation-name", "today-calendar-glow");
  await page.emulateMedia({reducedMotion:"reduce"});
  await expect(calendar).toHaveCSS("animation-name", "none");
  await page.locator("#calendar-open").click();
  await expect(page.locator("#today-task")).toHaveAttribute("data-daily-pending","");
  await page.locator("#today-task").click();
  await page.locator('#board button[data-index="0"]').click();
  await page.locator('#board button[data-index="1"]').click();
  await expect(page.locator("#win")).toBeVisible();
  await page.locator("#menu").click();
  await expect(daily).not.toHaveAttribute("data-daily-pending","");
});

test("a fresh field fades by column from left to right and deals once", async ({page}) => {
  await page.addInitScript(({settingsKey, progressKey}) => {
    localStorage.setItem(settingsKey,JSON.stringify({tutorialDone:true,languageChoice:"ru",sound:false,vibration:true}));
    localStorage.setItem(progressKey,JSON.stringify({
      version: 3, active: "classic", done: [], seen: [], hints: {},
      sessions: { classic: {
        rules: 1, history: [],
        current: { board: [5,5,0,2,3,4,6,7,8,1,0,9,2,3,4,6,7,8], scroll: 0, moves: 0, additions: 0 },
      }},
    }));
    Object.defineProperty(navigator,"vibrate",{value:(pattern:number|number[])=>{
      if(Array.isArray(pattern) && pattern.join(",")==="10,20,14,24,18") {
        const state = document.documentElement.dataset;
        state.deals = String(Number(state.deals ?? "0") + 1);
      }
      return true;
    }});
  },{settingsKey,progressKey});
  await page.goto("/");
  await page.locator("#resume").evaluate((button) => {
    button.addEventListener("click",()=>{
      const board = document.querySelector("#board")!;
      const wave = board.getAnimations({subtree:true})
        .filter(animation => animation.id === "board-entrance")
        .map(animation => {
          const effect = animation.effect as KeyframeEffect;
          const index = Number(effect.target!.parentElement!.dataset.index);
          return [index, effect.getTiming().delay, ...effect.getKeyframes().map(frame => frame.opacity)];
        });
      board.setAttribute("data-entrances", JSON.stringify(wave));
    });
  });
  await page.locator("#resume").click();
  const board = page.locator("#board");
  const wave: [number, number, string, string][] = JSON.parse((await board.getAttribute("data-entrances"))!);
  const delayAt = new Map(wave.map(([index, delay]) => [index, delay]));
  expect(wave).toHaveLength(16);
  expect(delayAt.get(0)).toBe(0);
  expect(delayAt.get(9)).toBe(delayAt.get(0));
  expect(delayAt.get(11)).toBeGreaterThan(delayAt.get(1)!);
  expect(delayAt.get(17)).toBe(delayAt.get(8));
  const firstRow = wave.filter(([index]) => index < 9);
  for (const [i, [, delay]] of firstRow.entries())
    if (i > 0) expect(delay).toBeGreaterThan(firstRow[i - 1][1]);
  expect(wave.every(([, , start, end]) => start === "0" && end === "1")).toBe(true);
  await expect(page.locator("html")).toHaveAttribute("data-deals","1");
  const first = board.locator("button").first();
  await first.click();
  await expect(first).toHaveAttribute("aria-pressed","true");
  await page.locator("#menu").click();
  await page.locator("#resume").click();
  await expect(board).toHaveAttribute("data-entrances","[]");
  await expect(page.locator("html")).toHaveAttribute("data-deals","1");
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
  await expect(page.locator("#lesson-detail")).toHaveText("Пары с суммой 10 можно соединять через край строки.");
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
    await page.clock.setFixedTime(new Date("2026-11-30T12:00:00+05:00"));
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
