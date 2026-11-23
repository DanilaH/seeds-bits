import {test,expect} from "@playwright/test";

// Video belongs to the real DOM game, not a mocked illustration.
// Store a short proof that New Classic opens a genuine sheet and starts a
// normal field, with the same rules and four difficulty bands.
test.use({video:"on"});
test("New Classic: home -> difficulty sheet -> ordinary board -> resume",async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.emulateMedia({reducedMotion:"reduce"});
  await page.addInitScript(()=>{
    localStorage.setItem("seeds-bits.settings.v1",JSON.stringify({
      tutorialDone:true,languageChoice:"ru",sound:false,vibration:false,
    }));
  });
  await page.goto("/");
  await expect(page.locator("#resume")).toBeVisible();
  await page.waitForTimeout(350);
  await page.locator("#next-classic").click();
  await expect(page.locator("#classic-new-sheet")).toBeVisible();
  await expect(page.locator(".classic-difficulty-option")).toHaveCount(4);
  await page.waitForTimeout(650);
  await page.locator('[data-classic-level="1"]').click();
  await expect(page.locator("#classic-new-sheet")).toBeHidden();
  await expect(page.locator("#dialog")).toBeHidden();
  await expect(page.locator("#mode")).toContainText("Классика");
  await expect(page.locator("#remaining")).toHaveText("28");
  await page.waitForTimeout(850);
  await page.locator("#menu").click();
  await expect(page.locator("#resume")).toBeVisible();
  await expect(page.locator("#home-difficulty")).toBeVisible();
  await page.waitForTimeout(400);
  const video=page.video();
  expect(video).not.toBeNull();
  await page.close();
  await video!.saveAs("test-results/classic-new-sheet/classic-new-flow.webm");
});
