import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, extname } from 'node:path';
const roots = { before: '/tmp/seeds-audit040-web', after: resolve('dist') };
const server = createServer((req, res) => {
  const [, version, ...parts] = req.url.split('?')[0].split('/');
  try {
    const file = resolve(roots[version], parts.join('/') || 'index.html');
    res.setHeader('Content-Type', {'.js':'text/javascript','.css':'text/css','.html':'text/html'}[extname(file)] || 'application/octet-stream');
    res.end(readFileSync(file));
  } catch {res.writeHead(404);res.end();}
});
await new Promise(r => server.listen(5197, '127.0.0.1', r));
const browser = await chromium.launch({executablePath: process.env.SEEDS_CHROMIUM || '/tmp/seeds-audit-chromium', args:['--no-sandbox']});
const results=[];
for (let run=0; run<3; run++) for (const version of ['before','after']) {
  const context = await browser.newContext({viewport:{width:390,height:844}});
  const page=await context.newPage();
  await page.addInitScript(() => {
    localStorage.setItem('seeds-bits.settings.v1',JSON.stringify({tutorialDone:true}));
    localStorage.setItem('seeds-bits.progress.v2',JSON.stringify({version:2,active:'classic',sessions:{classic:{rules:1,current:{board:Array(1800).fill(1),scroll:0,moves:0,additions:0},history:[]}},done:[],seen:[],hints:{}}));
  });
  await page.goto(`http://127.0.0.1:5197/${version}/`);
  await page.locator('#resume').click();
  const cdp=await context.newCDPSession(page);await cdp.send('Performance.enable');
  const metrics=async()=>Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(x=>[x.name,x.value]));
  await page.evaluate(()=>{
    window.auditTasks=[];window.auditMutations=0;
    new PerformanceObserver(l=>window.auditTasks.push(...l.getEntries().map(e=>e.duration))).observe({entryTypes:['longtask']});
    new MutationObserver(l=>window.auditMutations+=l.length).observe(document.querySelector('#board'),{attributes:true,subtree:true});
  });
  const start=await metrics();
  for(let i=0;i<15;i++){
    await page.locator('#board button').nth(0).click();
    await page.locator('#board button').nth(1).click();
    await page.waitForFunction(n=>document.querySelector('#remaining').textContent===String(n)&&!document.querySelector('#undo').disabled,1798-i*2);
  }
  await page.waitForTimeout(200);
  const end=await metrics();
  results.push({run,version,...await page.evaluate(()=>({longTasks:window.auditTasks,boardAttributeMutations:window.auditMutations})),metricsMs:Object.fromEntries(['TaskDuration','ScriptDuration','LayoutDuration','RecalcStyleDuration'].map(k=>[k,Math.round((end[k]-start[k])*1000)]))});
  await context.close();
}
await browser.close();await new Promise(r=>server.close(r));
writeFileSync('docs/repairs-0.4.1/performance.json',JSON.stringify(results,null,2)+'\n');
console.log(JSON.stringify(results));
