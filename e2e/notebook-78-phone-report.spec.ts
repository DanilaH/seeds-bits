import {test,expect,type Page} from "@playwright/test";

// Reconstructed from the 23 November phone report, then matched byte-for-byte
// against notebook-extra.json, id book-v1-78 (book 4, puzzle 6).
const board="000200060600070060006000000085700500064000000".split("").map(Number);
// Indices are taken from the shipped witness and adjusted after row compaction.
const witness:[[number,number],[number,number],[number,number],[number,number],[number,number],[number,number]]=[
  [16,20],[13,21],[3,19],[28,29],[20,24],[7,9],
];

test.use({viewport:{width:320,height:568},isMobile:true,hasTouch:true});
async function openTask(page:Page) {
  await page.emulateMedia({reducedMotion:"reduce"});
  await page.addInitScript(board=>{
    localStorage.setItem("seeds-bits.settings.v1",JSON.stringify({tutorialDone:true,languageChoice:"ru",sound:false,vibration:false}));
    localStorage.setItem("seeds-bits.progress.v2",JSON.stringify({
      version:3,active:"book-v1-78",done:Array.from({length:5},(_,i)=>`book-v1-${73+i}`),
      seen:[],hints:{},sessions:{"book-v1-78":{rules:1,current:{board,moves:0,additions:0,scroll:0},history:[]}},
    }));
  },board);
  await page.goto("/");
  await page.locator("#resume").click();
  await expect(page.locator("#mode")).toHaveText("Тетрадь 4 · задача 6");
  await expect(page.locator("#remaining")).toHaveText("12");
  await expect(page.locator("#undo")).toBeDisabled();
  expect(await page.locator("#board button").count()).toBe(12);
  // The screenshot includes a native 50dp banner; reserve the same area.
  await page.evaluate(()=>document.documentElement.classList.add("has-mobile-ads"));
}
async function tap(page:Page,index:number){
  const cell=page.locator(`#board button[data-index="${index}"]`);
  await expect(cell).toBeVisible();
  const {x,y,hit}=await cell.evaluate(el=>{
    el.scrollIntoView({block:"nearest",behavior:"instant"});
    const b=el.getBoundingClientRect(),x=b.left+b.width/2,y=b.top+b.height/2;
    return {x,y,hit:(document.elementFromPoint(x,y) as HTMLElement)?.closest("button.cell")===el};
  });
  expect(hit,`Cell ${index} obscured or intercepted`).toBe(true);
  await page.touchscreen.tap(x,y);
}
async function remove(page:Page,a:number,b:number,count:number) {
  await tap(page,a);
  await expect(page.locator(`#board button[data-index="${a}"]`)).toHaveAttribute("aria-pressed","true");
  await tap(page,b);
  await expect(page.locator("#remaining")).toHaveText(String(count));
}

test("report: both highlighted sixes and bottom 6+4 respond to real touch",async({page})=>{
  await openTask(page);
  // Highlighted vertical sixes: valid, but a losing branch.
  await remove(page,7,16,10);
  await expect(page.locator("#undo")).toBeEnabled();
  // A real hint should show that this branch is dead and offer a saved Undo.
  await page.locator("#hint").click();
  await expect(page.locator("#recover-task")).toBeVisible({timeout:10000});
  await page.locator("#recover-task").click();
  await expect(page.locator("#remaining")).toHaveText("12");
  // The highlighted bottom 6 + 4 also accepts a real touch.
  await remove(page,37,38,10);
});

test("report: hints select a solvable pair and six native-style taps finish book-v1-78",async({page})=>{
  await openTask(page);
  await page.locator("#hint").click();
  await expect(page.locator('#board button.hinted')).toHaveCount(2,{timeout:12000});
  await expect(page.locator('#board button[data-index="16"]')).toHaveClass(/hinted/);
  await expect(page.locator('#board button[data-index="20"]')).toHaveClass(/hinted/);
  for(let i=0;i<witness.length;i++){
    const [a,b]=witness[i];
    await remove(page,a,b,12-2*(i+1));
  }
  await expect(page.locator("#win")).toBeVisible();
  await expect(page.locator("#mode")).toContainText("Тетрадь 4");
});
