import { chooseBookVolume, exposeBookFilter } from "./book-controls";
// Real playable browser capture for PR #11. Recording enabled at file scope,
// as required by Playwright's worker isolation rules.
import {test,expect} from "@playwright/test";
import notebook from "../src/notebook.json" with {type:"json"};
import {pairs,removePair} from "../src/core";

test.use({video:"on"});

test("record saved task 2 after selecting New filter in catalog",async({page})=>{
  await page.setViewportSize({width:390,height:844});
  const board=notebook[1].board,match=pairs(board)[0];
  const progress={
    version:3,active:"book-v1-2",done:["book-v1-1"],seen:[],hints:{},
    sessions:{"book-v1-2":{rules:1,
      current:{board:removePair(board,match.a,match.b),moves:1,additions:0,scroll:0},
      history:[{board,moves:0,additions:0,scroll:0}],
    }},
    jars:{version:2,seeds:4,meter:4,wins:0,attempt:"followup-video",highWater:0},
  };
  await page.addInitScript(progress=>{
    localStorage.setItem("seeds-bits.settings.v1",JSON.stringify({tutorialDone:true,languageChoice:"ru",sound:false,vibration:false}));
    localStorage.setItem("seeds-bits.progress.v2",JSON.stringify(progress));
  },progress);
  await page.goto("/");
  await expect(page.locator("#dialog")).toHaveAttribute("open","");
  await page.locator("#book-mode").click();
  await (await exposeBookFilter(page)).selectOption("new");
  await page.locator("#collection-back").click();
  await expect(page.locator("#book-filter")).toHaveValue("new");
  await page.locator("#collection-back").click();
  await page.locator("#progress-open").click();
  await page.waitForTimeout(350);
  await expect(page.locator("#progress-book")).toContainText("Тетрадь 1");
  await page.locator("#progress-book").click();
  await expect(page.locator(".volume-heading h3")).toHaveText("Тетрадь 1");
  await expect(page.locator("#continue-book")).toHaveAttribute("data-continue","book-v1-2");
  await page.waitForTimeout(500);
  await page.locator("#continue-book").click();
  await expect(page.locator("#mode")).toHaveText("Тетрадь 1 · задача 2");
  await expect(page.locator("#undo")).toBeEnabled();
  await page.waitForTimeout(1100);
  const video=page.video();
  expect(video).not.toBeNull();
  await page.close();
  await video!.saveAs("test-results/calm-followup/progress-filter-to-task-2.webm");
});
