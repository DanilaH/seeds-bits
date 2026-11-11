import {test,expect} from '@playwright/test';
test.beforeEach(async({page})=>page.addInitScript(()=>{if(!localStorage.getItem('seeds-bits.settings.v1'))localStorage.setItem('seeds-bits.settings.v1',JSON.stringify({tutorialDone:true}));}));
test.afterEach(async({context},info)=>{if(info.status!==info.expectedStatus){let index=0;for(const p of context.pages()){await info.attach('settings-'+index++,{body:JSON.stringify(await p.evaluate(()=>({values:Object.fromEntries(Object.keys(localStorage).filter(k=>k.startsWith('seeds-bits.settings')).map(k=>[k,localStorage.getItem(k)])),theme:document.documentElement.dataset.theme,dark:(document.querySelector('#dark') as HTMLInputElement)?.checked,sound:(document.querySelector('#sound') as HTMLInputElement)?.checked}))),contentType:'application/json'});}}});
test('independent fields survive concurrent tabs',async({page,context})=>{
 await page.goto('/');await page.locator('#resume').click();await page.locator('#hint').click();await page.waitForTimeout(250);
 const other=await context.newPage();await other.goto('/');await other.locator('#settings-open').click();await page.locator('#menu').click();await page.locator('#settings-open').click();
 await page.locator('#dark').check();await other.locator('#sound').check();
 await expect(page.locator('#sound')).toBeChecked();await expect(other.locator('#dark')).toBeChecked();
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('seeds-bits.settings.v1')!))).toMatchObject({theme:'dark',sound:true});
 await other.reload();await other.locator('#settings-open').click();await expect(other.locator('#dark')).toBeChecked();await expect(other.locator('#sound')).toBeChecked();
});