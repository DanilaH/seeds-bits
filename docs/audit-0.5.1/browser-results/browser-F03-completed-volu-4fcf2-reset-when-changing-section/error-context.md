# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: browser.spec.ts >> F03 completed volume filter does not silently reset when changing section
- Location: scripts/audit-0.5.1/browser.spec.ts:28:1

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: "done"
Received: "all"
```

# Page snapshot

```yaml
- dialog "Меню Семечек" [ref=e3]:
  - generic [ref=e4]:
    - heading "Семечки" [level=2] [ref=e5]
    - button "Закрыть меню" [ref=e6] [cursor=pointer]: ×
  - generic [ref=e7]:
    - button "← Меню" [active] [ref=e8] [cursor=pointer]
    - heading "Тетради" [level=2] [ref=e9]
    - paragraph [ref=e10]: 100 тетрадей · 2400 задач
    - generic [ref=e11]:
      - generic [ref=e12]:
        - text: Раздел
        - combobox "Раздел" [ref=e13]:
          - option "1. Первые страницы"
          - option "2. Лёгкие линии"
          - option "3. Переплетения"
          - option "4. Простор"
          - option "5. Длинные дорожки"
          - option "6. Большие страницы"
          - option "7. Глубина"
          - option "8. Дальние маршруты"
          - option "9. Широкий горизонт"
          - option "10. Большое путешествие" [selected]
      - generic [ref=e14]:
        - text: Показать
        - combobox "Показать" [ref=e15]:
          - option "Все" [selected]
          - option "Не начаты"
          - option "В процессе"
          - option "Пройдены"
    - generic [ref=e16]:
      - button "Тетрадь 91, 0 из 24" [ref=e17] [cursor=pointer]:
        - strong [ref=e18]: "91"
        - generic [ref=e19]: 0/24
      - button "Тетрадь 92, 0 из 24" [ref=e20] [cursor=pointer]:
        - strong [ref=e21]: "92"
        - generic [ref=e22]: 0/24
      - button "Тетрадь 93, 0 из 24" [ref=e23] [cursor=pointer]:
        - strong [ref=e24]: "93"
        - generic [ref=e25]: 0/24
      - button "Тетрадь 94, 0 из 24" [ref=e26] [cursor=pointer]:
        - strong [ref=e27]: "94"
        - generic [ref=e28]: 0/24
      - button "Тетрадь 95, 0 из 24" [ref=e29] [cursor=pointer]:
        - strong [ref=e30]: "95"
        - generic [ref=e31]: 0/24
      - button "Тетрадь 96, 0 из 24" [ref=e32] [cursor=pointer]:
        - strong [ref=e33]: "96"
        - generic [ref=e34]: 0/24
      - button "Тетрадь 97, 0 из 24" [ref=e35] [cursor=pointer]:
        - strong [ref=e36]: "97"
        - generic [ref=e37]: 0/24
      - button "Тетрадь 98, 0 из 24" [ref=e38] [cursor=pointer]:
        - strong [ref=e39]: "98"
        - generic [ref=e40]: 0/24
      - button "Тетрадь 99, 0 из 24" [ref=e41] [cursor=pointer]:
        - strong [ref=e42]: "99"
        - generic [ref=e43]: 0/24
      - button "Тетрадь 100, 0 из 24" [ref=e44] [cursor=pointer]:
        - strong [ref=e45]: "100"
        - generic [ref=e46]: 0/24
    - generic [ref=e47]:
      - heading "Тетрадь 91" [level=3] [ref=e48]
      - generic [ref=e49]: 0/24
    - button "Продолжить тетрадь" [ref=e50] [cursor=pointer]
    - generic [ref=e51]:
      - generic [ref=e52]:
        - heading "Страница 1" [level=3] [ref=e53]
        - generic [ref=e54]: 0/6
      - generic [ref=e55]:
        - button "Задача 2161" [ref=e56] [cursor=pointer]: "1"
        - button "Задача 2162" [ref=e57] [cursor=pointer]: "2"
        - button "Задача 2163" [ref=e58] [cursor=pointer]: "3"
        - button "Задача 2164" [ref=e59] [cursor=pointer]: "4"
        - button "Задача 2165" [ref=e60] [cursor=pointer]: "5"
        - button "Задача 2166" [ref=e61] [cursor=pointer]: "6"
    - generic [ref=e62]:
      - generic [ref=e63]:
        - heading "Страница 2" [level=3] [ref=e64]
        - generic [ref=e65]: 0/6
      - generic [ref=e66]:
        - button "Задача 2167" [ref=e67] [cursor=pointer]: "7"
        - button "Задача 2168" [ref=e68] [cursor=pointer]: "8"
        - button "Задача 2169" [ref=e69] [cursor=pointer]: "9"
        - button "Задача 2170" [ref=e70] [cursor=pointer]: "10"
        - button "Задача 2171" [ref=e71] [cursor=pointer]: "11"
        - button "Задача 2172" [ref=e72] [cursor=pointer]: "12"
    - generic [ref=e73]:
      - generic [ref=e74]:
        - heading "Страница 3" [level=3] [ref=e75]
        - generic [ref=e76]: 0/6
      - generic [ref=e77]:
        - button "Задача 2173" [ref=e78] [cursor=pointer]: "13"
        - button "Задача 2174" [ref=e79] [cursor=pointer]: "14"
        - button "Задача 2175" [ref=e80] [cursor=pointer]: "15"
        - button "Задача 2176" [ref=e81] [cursor=pointer]: "16"
        - button "Задача 2177" [ref=e82] [cursor=pointer]: "17"
        - button "Задача 2178" [ref=e83] [cursor=pointer]: "18"
    - generic [ref=e84]:
      - generic [ref=e85]:
        - heading "Страница 4" [level=3] [ref=e86]
        - generic [ref=e87]: 0/6
      - generic [ref=e88]:
        - button "Задача 2179" [ref=e89] [cursor=pointer]: "19"
        - button "Задача 2180" [ref=e90] [cursor=pointer]: "20"
        - button "Задача 2181" [ref=e91] [cursor=pointer]: "21"
        - button "Задача 2182" [ref=e92] [cursor=pointer]: "22"
        - button "Задача 2183" [ref=e93] [cursor=pointer]: "23"
        - button "Задача 2184" [ref=e94] [cursor=pointer]: "24"
```

# Test source

```ts
  1  | import {test,expect} from '@playwright/test';
  2  | import {writeFileSync} from 'node:fs';
  3  | const out='docs/audit-0.5.1',key='seeds-bits.progress.v2';
  4  | const snap=(board:number[])=>({rules:1,current:{board,moves:0,additions:0,scroll:0},history:[]});
  5  | async function seed(page:any,active='classic',board=[5,5,5,5],done:string[]=[],seeds=0){
  6  |  await page.addInitScript(({active,board,done,seeds,key}:any)=>{
  7  |   if(sessionStorage.seeded)return;sessionStorage.seeded='1';
  8  |   localStorage.setItem('seeds-bits.settings.v1',JSON.stringify({tutorialDone:true,sound:true}));
  9  |   localStorage.setItem(key,JSON.stringify({version:3,active,sessions:{[active]:{rules:1,current:{board,moves:0,additions:0,scroll:0},history:[]}},done,seen:[],hints:{},meta:{version:1,since:'2026-10-20',completed:done.length,unassisted:0,attempts:{[active]:{id:'audit',completed:false}}},jars:{version:1,seeds,wins:0,highWater:0,attempt:'audit'}}));
  10 |  },{active,board,done,seeds,key});
  11 | }
  12 | const save=(name:string,value:any)=>writeFileSync(`${out}/${name}.json`,JSON.stringify(value,null,2));
  13 | async function boot(page:any){await page.goto('/');await page.locator('#resume').click();}
  14 | async function pair(page:any){await page.locator('#board button').nth(0).click();await page.locator('#board button').nth(1).click();}
  15 | test('F01 second notebook completed page uses local page number',async({page})=>{
  16 |  await seed(page,'book-v1-30',[5,5],Array.from({length:5},(_,i)=>`book-v1-${i+25}`));await boot(page);await pair(page);await expect(page.locator("#win")).toBeVisible();
  17 |  const award=await page.locator('#award').innerText();save('page-number',{award,expected:'Страница 1 завершена'});await page.screenshot({path:out+'/page-number.png'});
  18 |  expect(award).toBe('✓ Страница 1 завершена');
  19 | });
  20 | test('F02 book chunk failure is visible in open modal and retry clears loading',async({page})=>{
  21 |  await seed(page);let blocked=true;await page.route('**/notebook-extra-*.js',r=>blocked?r.abort():r.continue());
  22 |  await page.goto('/');await page.locator('#book-mode').click();await page.locator('[data-volume="1"]').click();await page.locator('[data-game="book-v1-25"]').click();
  23 |  await page.waitForTimeout(300);const before=await page.locator('#dialog').innerText();blocked=false;
  24 |  await page.locator('[data-game="book-v1-25"]').click();await page.waitForTimeout(500);
  25 |  save('chunk-failure',{before,dialogOpen:await page.locator('#dialog').isVisible(),after:await page.locator('#dialog').innerText(),status:await page.locator('#status').textContent()});await page.screenshot({path:out+'/chunk-failure.png'});
  26 |  expect(before).toContain('Не удалось');await expect(page.locator('#dialog')).toBeHidden();
  27 | });
  28 | test('F03 completed volume filter does not silently reset when changing section',async({page})=>{
  29 |  await seed(page,'classic',[5,5],Array.from({length:24},(_,i)=>`book-v1-${i+1}`));await page.goto('/');await page.locator('#book-mode').click();await page.locator('#book-filter').selectOption('done');await page.locator('#book-chapter').selectOption('9');
  30 |  save('filter',{value:await page.locator('#book-filter').inputValue(),covers:await page.locator('[data-volume]').count()});
> 31 |  expect(await page.locator('#book-filter').inputValue()).toBe('done');
     |                                                          ^ Error: expect(received).toBe(expected) // Object.is equality
  32 | });
  33 | test('F04 calendar 2028 leap-day and 2125 trophies',async({page})=>{
  34 |  await page.clock.setFixedTime(new Date('2028-06-20T12:00:00'));await seed(page);await page.goto('/');await page.locator('#calendar-open').click();await page.locator('#calendar-month').selectOption('02');
  35 |  await expect(page.locator('[data-game="daily-v1-2028-02-29"]')).toBeEnabled();await expect(page.locator('[data-game="daily-v1-2028-02-30"]')).toHaveCount(0);
  36 |  await page.clock.setFixedTime(new Date('2125-06-20T12:00:00'));await page.locator('#collection-back').click();await page.locator('#trophies-mode').click();await page.locator('#trophy-year').selectOption('2125');
  37 |  const n=await page.locator('[data-month]').count();save('long-calendar',{year:2125,months:n});expect(n).toBe(6);
  38 | });
  39 | test('F05 rotation during flights settles rewards and leaves no particles',async({page})=>{
  40 |  await seed(page,'classic',Array(40).fill(5),[],22);await boot(page);await pair(page);await page.setViewportSize({width:844,height:390});await page.waitForTimeout(1200);
  41 |  await expect(page.locator('.flying-seed')).toHaveCount(0);await expect(page.locator('#jar-percent')).toContainText('0/60');
  42 |  const p=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)!),key);expect(p.jars.seeds).toBe(24);await page.reload();await page.locator('#resume').click();await expect(page.locator('#remaining')).toHaveText('38');
  43 | });
  44 | test('F06 collection pagination retains all jars across pages',async({page})=>{
  45 |  await seed(page,'classic',[5,5],[],100000);await page.goto('/');await page.locator('#trophies-mode').click();
  46 |  const seen:string[]=[];for(let i=0;i<20;i++){seen.push(...await page.locator('.jar-keepsake small').allTextContents());if(await page.locator('#older-jars').isDisabled())break;await page.locator('#older-jars').click();}
  47 |  expect(new Set(seen).size).toBe(seen.length);expect(seen.some(s=>s.endsWith('· 1'))).toBe(true);save('jar-pages',{count:seen.length,unique:new Set(seen).size});
  48 | });
  49 | test('F07 enlarged body text and save failure in short landscape remain reachable',async({page})=>{
  50 |  await page.setViewportSize({width:568,height:320});await seed(page,'classic',Array(90).fill(5));await boot(page);
  51 |  await page.addStyleTag({content:'body {font-size:200%}'});
  52 |  await page.evaluate(()=>{const orig=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='seeds-bits.progress.v2')throw new DOMException('full','QuotaExceededError');return orig.call(this,k,v)}});
  53 |  await pair(page);await expect(page.locator('#save-notice')).toBeVisible();await page.screenshot({path:out+'/landscape-save-failure.png'});
  54 |  const metrics=await page.evaluate(()=>Object.fromEntries(['viewport','save-notice','menu','retry-save','undo'].map(id=>{const r=document.getElementById(id)!.getBoundingClientRect();return[id,{x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom}]})));save('landscape-save-failure',metrics);
  55 |  expect(metrics.viewport.height).toBeGreaterThan(100);await page.locator('#menu').click();await expect(page.locator('#dialog')).toBeVisible();
  56 | });
  57 | test('F08 navigation stress and tab conflict never silently overwrite',async({page,context})=>{
  58 |  await seed(page);await boot(page);const other=await context.newPage();await other.goto('/');await other.locator('#resume').click();await pair(page);
  59 |  await pair(other);await expect(other.locator('#save-notice')).toContainText('другой вкладке');
  60 |  for(let i=0;i<15;i++){await page.locator('#menu').click();await page.locator('#book-mode').click();await page.locator('#collection-back').click();await page.locator('#resume').click();}
  61 |  const p=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)!),key);expect(p.sessions.classic.current.moves).toBe(1);expect(p.jars.seeds).toBe(2);
  62 | });
  63 | test('F09 dead notebook controls do not overlap sidebar metadata',async({page})=>{
  64 |  await page.setViewportSize({width:568,height:320});await seed(page,'book-v1-25',[1,2]);await boot(page);await page.screenshot({path:out+'/dead-landscape.png'});
  65 |  const m=await page.evaluate(()=>{const a=document.querySelector('.status-wrap')!.getBoundingClientRect(),b=document.querySelector('#page-progress')!.getBoundingClientRect();return{statusTop:a.top,pageBottom:b.bottom,overlap:a.top<b.bottom}});save('dead-landscape',m);expect(m.overlap).toBe(false);
  66 | });
  67 | test('F10 ordinary text save failure does not overlap jar and mode',async({page})=>{
  68 |  await page.setViewportSize({width:568,height:320});await seed(page,'classic',Array(90).fill(5));await boot(page);
  69 |  await page.evaluate(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='seeds-bits.progress.v2')throw new DOMException('full','QuotaExceededError');return original.call(this,k,v)}});await pair(page);await expect(page.locator('#save-notice')).toBeVisible();
  70 |  await page.screenshot({path:out+'/normal-save-failure.png'});const m=await page.evaluate(()=>{const a=document.querySelector('.status-wrap')!.getBoundingClientRect(),b=document.querySelector('.game-meta')!.getBoundingClientRect();return{statusTop:a.top,modeBottom:b.bottom,overlap:a.top<b.bottom}});save('normal-save-failure',m);expect(m.overlap).toBe(false);
  71 | });
  72 | test('F11 offscreen hint can scroll to second number in landscape',async({page})=>{
  73 |  await page.setViewportSize({width:568,height:320});const b=Array(540).fill(0);b[0]=b[539]=5;await seed(page,'classic',b);await boot(page);await page.locator('#hint').click();await expect(page.locator('.hinted')).toHaveCount(2);await expect(page.locator('#hint-jump')).toBeVisible();await page.screenshot({path:out+'/hint-landscape.png'});save('hint-hit-target',await page.locator('#hint-jump').evaluate(el=>{const r=el.getBoundingClientRect();return{rect:{x:r.x,y:r.y,w:r.width,h:r.height},hit:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.outerHTML.slice(0,200),parentOverflow:getComputedStyle(el.parentElement!).overflow}}));await page.locator('#hint-jump').click({timeout:1500});await expect(page.locator('[data-index="539"]')).toBeInViewport();await page.screenshot({path:out+'/hint-landscape.png'});
  74 | });
  75 | test('F12 doubling every text size keeps menu and play reachable',async({page})=>{
  76 |  await page.setViewportSize({width:667,height:375});await seed(page);await boot(page);
  77 |  await page.evaluate(()=>{const targets=[...document.querySelectorAll<HTMLElement>('button, p, label, h1, h2, h3, strong, small, #mode, #page-progress')];const sizes=targets.map(e=>parseFloat(getComputedStyle(e).fontSize));targets.forEach((e,i)=>e.style.fontSize=(sizes[i]*2)+'px')});
  78 |  await page.screenshot({path:out+'/enlarged-landscape.png'});const m=await page.evaluate(()=>{const a=document.querySelector('.status-wrap')!.getBoundingClientRect(),b=document.querySelector('.game-meta')!.getBoundingClientRect();return{statusTop:a.top,modeBottom:b.bottom,overlap:a.top<b.bottom,overflow:document.documentElement.scrollWidth>innerWidth}});save('enlarged-landscape',m);await page.locator('#menu').click();await expect(page.locator('#dialog')).toBeVisible();expect(m.overlap).toBe(false);
  79 | });
  80 | for(const [w,h] of [[390,844],[844,390],[1280,800]]) test(`F13 hint hit test ${w}x${h}`,async({page})=>{
  81 |  await page.setViewportSize({width:w,height:h});const board=Array(540).fill(0);board[0]=board[539]=5;await seed(page,'classic',board);await boot(page);await page.locator('#hint').click();await expect(page.locator('.hinted')).toHaveCount(2);
  82 |  const m=await page.locator('#hint-jump').evaluate(el=>{const r=el.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return{w:innerWidth,h:innerHeight,label:el.textContent,hitsButton:hit===el||el.contains(hit),hitTag:hit?.tagName}});save(`hint-${w}`,m);await page.screenshot({path:out+`/hint-${w}.png`});expect(m.hitsButton).toBe(true);
  83 | });
  84 | test('F14 fresh reload recovers blocked notebook chunk',async({page})=>{
  85 |  await seed(page);let blocked=true;await page.route('**/notebook-extra-*.js',r=>blocked?r.abort():r.continue());await page.goto('/');await page.locator('#book-mode').click();await page.locator('[data-volume="1"]').click();await page.locator('[data-game="book-v1-25"]').click();await page.waitForTimeout(250);blocked=false;
  86 |  await page.reload();await page.locator('#book-mode').click();await page.locator('[data-volume="1"]').click();await page.locator('[data-game="book-v1-25"]').click();await expect(page.locator('#dialog')).toBeHidden();await expect(page.locator('#mode')).toHaveText('Тетрадь 2 · задача 1');
  87 | });
  88 |
```
