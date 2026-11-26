import {test,expect,type Page,type BrowserContext} from '@playwright/test';
import {installLegacyClassic,openClassicNew} from './restore-game';
import {classic,removePair,occupied} from '../src/core';
import {CLASSIC_START_COUNTS} from '../src/classic-generator';
const key='seeds-bits.progress.v2';
const state=(page:Page)=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)!),key);
async function boot(page:Page, finish=false) {
  await page.addInitScript(({key,finish})=>{
    const log=(type:string,value?:string)=>{
      const events=JSON.parse(sessionStorage.getItem('qt45-trace')??'[]');
      let state:any;try{const p=JSON.parse(value??localStorage.getItem(key)??'{}');state={count:p.sessions?.classic?.current?.board.filter(Boolean).length,moves:p.sessions?.classic?.current?.moves,history:(p.sessions?.classic?.history??p.sessions?.classic?.packedHistory)?.length,attempt:p.meta?.attempts?.classic?.id};}catch{}
      events.push({type,at:Date.now(),visibility:document.visibilityState,...state});
      sessionStorage.setItem('qt45-trace',JSON.stringify(events.slice(-160)));
    };
    const write=Storage.prototype.setItem;
    Storage.prototype.setItem=function(k,v){
      if(k!==key)return write.call(this,k,v);
      log('write-begin',v);try{write.call(this,k,v);log('write-success',v);}catch(error){log('write-failed',v);throw error;}
    };
    log('document-init');
    addEventListener('pagehide',()=>log('pagehide'));
    addEventListener('pageshow',()=>log('pageshow'));
    document.addEventListener('visibilitychange',()=>log('visibilitychange'));
    if(sessionStorage.getItem('stability-seeded'))return;
    sessionStorage.setItem('stability-seeded','1');
    localStorage.setItem('seeds-bits.settings.v1',JSON.stringify({tutorialDone:true,sound:false,vibration:false}));
    if(finish)localStorage.setItem(key,JSON.stringify({version:2,active:'classic',done:[],seen:[],hints:{},
      sessions:{classic:{rules:1,current:{board:[5,5],moves:0,additions:0,scroll:0},history:[]}},
      meta:{version:1,since:'2026-10-20T00:00:00Z',attempts:{classic:{id:'stability-old',completed:false}},completed:5,unassisted:3}}));
  },{key,finish});
  await installLegacyClassic(page);
  await page.goto('/');
  await page.locator('#resume').click();
  // Drain the real lock queue, without an elapsed-time assumption.
  await page.evaluate(()=>navigator.locks.request('seeds-save',()=>{}));
}
async function hold(context:BrowserContext) {
  const blocker=await context.newPage();
  await blocker.route('**/storage-lock-owner', route=>route.fulfill({contentType:'text/html',body:'<!doctype html>'}));
  await blocker.goto('/storage-lock-owner');
  await blocker.evaluate(()=>navigator.locks.request('seeds-save',()=>{}));
  await blocker.evaluate(()=>new Promise<void>(acquired=>{
    const w=window as any;
    navigator.locks.request('seeds-save',async()=>{
      acquired(); await new Promise<void>(resolve=>w.releaseWrite=resolve);
    });
  }));
  return {release:async()=>{await blocker.evaluate(()=>(window as any).releaseWrite());await blocker.close();}};
}
async function trace(page:Page,label:string) {
  const value={label,remaining:await page.locator('#remaining').textContent(),
    persistence:await page.locator('.game').getAttribute('data-persistence'),
    lifecycle:await page.evaluate(()=>JSON.parse(sessionStorage.getItem('qt45-trace')??'[]')),save:await state(page)};
  console.log('STABILITY_TRACE',JSON.stringify(value));
  await test.info().attach(label,{body:JSON.stringify(value,null,2),contentType:'application/json'});
  return value.save;
}
test('QT01 delayed write keeps the accepted count pending; durable move and Undo survive immediate reload',async({page,context})=>{
  await boot(page);
  const before=await state(page), blocker=await hold(context);
  try {
    await page.locator('[data-index="0"]').click(); await page.locator('[data-index="9"]').click();
    const pending=await trace(page,'pair-write-held');
    expect(pending.sessions.classic).toEqual(before.sessions.classic);
    await expect(page.locator('#board')).toHaveAttribute('aria-busy','true');
    await expect(page.locator('#status')).toContainText('Сохраняем ход');
    await expect(page.locator('#remaining')).toHaveText('26');
  } finally {await blocker.release();}
  await expect(page.locator('#remaining')).toHaveText('26');
  await expect(page.locator('.game')).toHaveAttribute('data-persistence','saved');
  const committed=await trace(page,'pair-durable');
  expect(committed.sessions.classic.current.board).toEqual(removePair(classic(),0,9));
  expect(committed.sessions.classic.current.moves).toBe(1);
  expect(committed.sessions.classic.history ?? committed.sessions.classic.packedHistory).toHaveLength(1);
  await page.reload(); await page.locator('#resume').click();
  await expect(page.locator('#remaining')).toHaveText('26');
  expect((await state(page)).sessions.classic).toEqual(committed.sessions.classic);
  await page.locator('#undo').click();
  await expect(page.locator('#remaining')).toHaveText('28');
  await expect(page.locator('.game')).toHaveAttribute('data-persistence','saved');
  expect(occupied((await state(page)).sessions.classic.current.board)).toBe(28);
  await page.reload(); await page.locator('#resume').click();
  await expect(page.locator('#remaining')).toHaveText('28');
});
test('QT01 reload before commit restores the previous durable board without claiming a saved move',async({page,context})=>{
  await boot(page);const blocker=await hold(context);
  try {
    await page.locator('[data-index="0"]').click();await page.locator('[data-index="9"]').click();
    await trace(page,'reload-before-commit');
    await expect(page.locator('#board')).toHaveAttribute('aria-busy','true');
    await page.reload({waitUntil:'commit'});
  }finally{await blocker.release();}
  await expect(page.locator('#resume')).toBeVisible();await page.locator('#resume').click();
  await expect(page.locator('#remaining')).toHaveText('28');
  expect((await state(page)).sessions.classic.current.moves).toBe(0);
});
test('QT01 failed pair write is explicit; retry saves exact board/history and does not duplicate gains',async({page})=>{
  await boot(page);const before=await state(page);
  await page.evaluate(key=>{
    const original=Storage.prototype.setItem;(window as any).restoreWrite=()=>Storage.prototype.setItem=original;
    Storage.prototype.setItem=function(k,v){if(k===key)throw new DOMException('quota','QuotaExceededError');original.call(this,k,v);};
  },key);
  await page.locator('[data-index="0"]').click();await page.locator('[data-index="9"]').click();
  await expect(page.locator('#remaining')).toHaveText('26');
  await expect(page.locator('#save-notice')).toBeVisible();
  expect((await state(page)).sessions.classic).toEqual(before.sessions.classic);
  await trace(page,'pair-write-failed');
  await page.evaluate(()=>(window as any).restoreWrite());await page.locator('#retry-save').click();
  await expect(page.locator('#save-notice')).toBeHidden();
  const saved=await trace(page,'pair-retried');
  expect(saved.sessions.classic.current.moves).toBe(1);expect(saved.sessions.classic.history ?? saved.sessions.classic.packedHistory).toHaveLength(1);
  expect(saved.sessions.classic.current.board).toEqual(removePair(classic(),0,9));
  await page.reload();await page.locator('#resume').click();await expect(page.locator('#remaining')).toHaveText('26');
  const reloaded=await state(page);expect(reloaded.jars).toEqual(saved.jars);expect(reloaded.meta.completed).toBe(saved.meta.completed);
});
test('QT02 new Classic is atomic under a held commit and repeated clicks; previous completion pays once',async({page,context})=>{
  await boot(page,true);await page.locator('[data-index="0"]').click();await page.locator('[data-index="1"]').click();
  await expect(page.locator('#win')).toBeVisible();
  const completed=await state(page);expect(completed.meta.completed).toBe(6);
  await page.reload();await expect(page.locator('#resume')).toBeVisible();
  await page.locator('#classic-mode').click();
  if(await page.locator('#next-classic').isVisible())await page.locator('#next-classic').click();
  const blocker=await hold(context);
  try{
    // Do not call the durable helper here: deliberately inspect the held transaction.
    await page.locator('[data-classic-level="1"]').click();
    await trace(page,'new-classic-write-held');
    expect((await state(page)).sessions.classic).toEqual(completed.sessions.classic);
    expect((await state(page)).meta.completed).toBe(6);
    // A second synthetic click exercises the runtime guard, not Playwright's actionability gate.
    await page.evaluate(()=>document.querySelector<HTMLButtonElement>('[data-classic-level="1"]')!.click());
  }finally{await blocker.release();}
  await expect(page.locator('#dialog')).toBeHidden();
  const next=await trace(page,'new-classic-durable'), board=next.sessions.classic.current.board;
  expect(CLASSIC_START_COUNTS[1]).toContain(occupied(board));
  expect(next.sessions.classic.history ?? next.sessions.classic.packedHistory).toEqual([]);expect(next.sessions.classic.current.moves).toBe(0);
  expect(next.meta.classicRun.current.board).toEqual(board);
  expect(next.meta.attempts.classic.completed).toBe(false);
  expect(next.meta.attempts.classic.id).not.toBe(completed.meta.attempts.classic.id);
  expect(next.meta.completed).toBe(6);expect(next.meta.wallet).toBe(completed.meta.wallet);expect(next.jars.meter).toBe(completed.jars.meter);
  await page.reload();await page.locator('#resume').click();
  expect((await state(page)).sessions.classic).toEqual(next.sessions.classic);
  expect((await state(page)).meta.completed).toBe(6);
});

test('QT02 failed new Classic leaves the completed attempt authoritative; retry cannot replay completion rewards',async({page})=>{
  await boot(page,true);await page.locator('[data-index="0"]').click();await page.locator('[data-index="1"]').click();
  await expect(page.locator('#win')).toBeVisible();await page.reload();await expect(page.locator('#resume')).toBeVisible();
  const completed=await state(page);
  await page.evaluate(key=>{
    const original=Storage.prototype.setItem;(window as any).restoreWrite=()=>Storage.prototype.setItem=original;
    Storage.prototype.setItem=function(k,v){if(k===key)throw new DOMException('quota','QuotaExceededError');original.call(this,k,v);};
  },key);
  await page.locator('#classic-mode').click();
  if(await page.locator('#next-classic').isVisible())await page.locator('#next-classic').click();
  await page.locator('[data-classic-level="1"]').click();
  await expect(page.locator('#save-notice')).toBeVisible();
  const failed=await trace(page,'new-classic-write-failed');
  expect(failed.sessions.classic).toEqual(completed.sessions.classic);
  expect(failed.meta.classicRun).toEqual(completed.meta.classicRun);
  expect(failed.meta.attempts.classic).toEqual(completed.meta.attempts.classic);
  expect(failed.meta.completed).toBe(6);expect(failed.meta.wallet).toBe(completed.meta.wallet);
  await page.evaluate(()=>(window as any).restoreWrite());await page.locator('#retry-save').click();
  await expect(page.locator('#save-notice')).toBeHidden();
  expect((await state(page)).meta.attempts.classic).toEqual(completed.meta.attempts.classic);
  await openClassicNew(page,1);const next=await trace(page,'new-classic-after-retry');
  expect(CLASSIC_START_COUNTS[1]).toContain(occupied(next.sessions.classic.current.board));
  expect(next.meta.completed).toBe(6);expect(next.meta.wallet).toBe(completed.meta.wallet);
  expect(next.meta.attempts.classic.completed).toBe(false);
});
