import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import notebook from '../src/notebook.json' with {type:'json'};
import {occupied,removePair} from '../src/core';
import {unpackSession} from '../src/history-codec';
const key='seeds-bits.progress.v2',dir='test-results/functional-audit';
fs.mkdirSync(dir,{recursive:true});
const file=(n:string,v:any)=>fs.writeFileSync(dir+'/'+n+'.json',JSON.stringify(v,null,2));
test('FA-01 real notebook rollback while durable writer is held',async({page,context})=>{
 const puzzle=notebook[4],id=puzzle.id;
 await page.addInitScript(({key,id,board})=>{if(localStorage.getItem(key))return;localStorage.setItem('seeds-bits.settings.v1',JSON.stringify({tutorialDone:true,languageChoice:'ru',sound:false,vibration:false}));localStorage.setItem(key,JSON.stringify({version:3,active:id,done:[],seen:[],hints:{},sessions:{[id]:{rules:1,current:{board,moves:0,additions:0,scroll:0},history:[]}},meta:{version:2,wallet:0,since:'2026-11-10',completed:0,unassisted:0,attempts:{[id]:{id:'functional-rollback',completed:false}}}}));},{key,id,board:puzzle.board});
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');await page.locator('#resume').click();await expect(page.locator('#dialog')).toBeHidden();
 let b=puzzle.board;for(const [a,c] of [[3,4],[5,13],[6,15],[2,11]]){b=removePair(b,a,c);await page.locator('#board button[data-index="'+a+'"]').click();await page.locator('#board button[data-index="'+c+'"]').click();await expect(page.locator('#remaining')).toHaveText(String(occupied(b)));}
 const disk=()=>page.evaluate(({key,id})=>JSON.parse(localStorage.getItem(key)!).sessions[id],{key,id});
 await expect.poll(async()=>unpackSession(await disk()).current.moves).toBe(4);
 await expect(page.locator('.game')).toHaveAttribute('data-persistence','saved');
 await page.locator('#hint').click();await expect(page.locator('#no-moves-primary')).toHaveText('Отменить 2 хода');
 const blocker=await context.newPage();await blocker.route('**/storage-lock-owner',r=>r.fulfill({contentType:'text/html',body:'<!doctype html>'}));await blocker.goto('/storage-lock-owner');
 await blocker.evaluate(()=>{(window as any).acquired=new Promise<void>(ok=>{void navigator.locks.request('seeds-save',async()=>{ok();await new Promise<void>(done=>(window as any).release=done);});});});await blocker.evaluate(()=>(window as any).acquired);
 try{await page.locator('#no-moves-primary').click();const snapshot=await page.evaluate(()=>({status:document.querySelector('#status')?.textContent,remaining:document.querySelector('#remaining')?.textContent,persistence:document.querySelector('.game')?.getAttribute('data-persistence'),ariaBusy:document.querySelector('#board')?.getAttribute('aria-busy')}));
 const stored=unpackSession(await disk());file('rollback-held',{snapshot,diskMoves:stored.current.moves,diskRemaining:occupied(stored.current.board),expectedRestoredMoves:2});
 await page.screenshot({path:dir+'/rollback-held.png'});await blocker.evaluate(()=>(window as any).release());await expect.poll(async()=>unpackSession(await disk()).current.moves).toBe(2);
 file('rollback-committed',{moves:unpackSession(await disk()).current.moves});}
 finally{await blocker.close();}
});
test('FA-03 save conflict contract without Web Locks, actual platform module',async({page})=>{
 await page.goto('/');await page.locator('#app').waitFor();
 const a=await page.evaluate(async()=>{const p=await import('/src/platform.ts');const k='audit.concurrent.state',s='audit.concurrent.settings';localStorage.setItem(k,'base');Object.defineProperty(navigator,'locks',{value:undefined,configurable:true});const results=await Promise.allSettled([p.saveState(k,'A','base',s,'{}'),p.saveState(k,'B','base',s,'{}')]);return {results:results.map(x=>x.status),final:localStorage.getItem(k)};});
 file('no-web-locks',a);
});
test('FA-04 browser denied storage: real game status and reload',async({page})=>{
 await page.addInitScript(()=>{const get=Storage.prototype.getItem;Storage.prototype.getItem=function(k){if(this===localStorage)throw new DOMException('audit storage denied','SecurityError');return get.call(this,k);};const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(this===localStorage)throw new DOMException('audit storage denied','SecurityError');return set.call(this,k,v);};});
 const errors:string[]=[];page.on('pageerror',e=>errors.push(String(e)));await page.goto('/');await page.waitForTimeout(600);
 const before=await page.evaluate(()=>({status:document.querySelector('#status')?.textContent,warning:document.querySelector('#save-warning')?.textContent,body:document.body.innerText.slice(0,1300),screen:document.querySelector('#dialog')?.getAttribute('data-screen')}));
 file('blocked-browser-storage',{before,errors});
});
