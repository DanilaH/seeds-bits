import {test,expect} from 'vitest';
import fs from 'node:fs';
import {pairs,removePair,commit,occupied} from '../src/core';
import {createSolver} from '../src/solver';
import {notebookForTask,notebook,loadNotebook,puzzleSession} from '../src/puzzles';
import {loadBookV5} from '../src/content-v5';
import {bookRevisionFor} from '../src/content-ids';
import {fresh,metadata,recordCompletion,startAttempt,serializeProgress,readProgress} from '../src/progress';
const dir='test-results/functional-followup';fs.mkdirSync(dir,{recursive:true});
let seed=0x5d9f11;
const rand=(n:number)=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return (seed>>>0)%n;};
function allowed(b:readonly number[],i:number,j:number){if(i===j||!b[i]||!b[j]||!(b[i]===b[j]||b[i]+b[j]===10))return false;
 if(b.slice(Math.min(i,j)+1,Math.max(i,j)).every(x=>!x))return true;
 const dy=Math.floor(j/9)-Math.floor(i/9),dx=j%9-i%9;if(dx&&dy&&Math.abs(dx)!==Math.abs(dy))return false;
 for(let n=1;n<Math.max(Math.abs(dx),Math.abs(dy));n++)if(b[i+n*(Math.sign(dx)+9*Math.sign(dy))])return false;return true;}
const op=(b:readonly number[])=>{const a:[number,number][]=[];for(let i=0;i<b.length;i++)if(b[i])for(let j=i+1;j<b.length;j++)if(allowed(b,i,j))a.push([i,j]);return a;};
function remove(b:readonly number[],i:number,j:number){const a=[...b];a[i]=a[j]=0;const out:number[]=[];for(let k=0;k<a.length;k+=9){const row=a.slice(k,k+9);if(row.some(Boolean))out.push(...row);}return out;}
test('balanced independent solver samples and near-limit field checks',()=>{
 const res={boards:0,winning:0,dead:0,unknown:0,errors:[],largeFields:0,largePairs:0};const memo=new Map<string,boolean>();
 function solvable(b:readonly number[]):boolean{if(!b.some(Boolean))return true;const k=b.join('');if(memo.has(k))return memo.get(k)!;const answer=op(b).some(([a,c])=>solvable(remove(b,a,c)));memo.set(k,answer);return answer;}
 for(let i=0;i<1200;i++){let b:number[];if(i%2===0){b=[];for(let j=0;j<2+rand(6);j++){const v=1+rand(9);b.push(v,...Array(rand(2)).fill(0),rand(2)?v:10-v,...Array(rand(2)).fill(0));}}else b=Array.from({length:3+rand(15)},()=>rand(10));if(!b.some(Boolean))continue;
 const expected=solvable(b),a=createSolver(100000)(b);if(a.kind==='unknown')res.unknown++;else{expect(a.kind==='move',b.join('')).toBe(expected);if(a.kind==='move'){expect(allowed(b,a.pair.a,a.pair.b)).toBe(true);expect(solvable(remove(b,a.pair.a,a.pair.b))).toBe(true);res.winning++;}else res.dead++;}res.boards++;}
 for(let i=0;i<12;i++){const b=Array.from({length:1789+rand(12)},()=>rand(5)===0?1+rand(9):0);const expected=op(b);expect(pairs(b).map(p=>[p.a,p.b])).toEqual(expected);res.largeFields++;res.largePairs+=expected.length;}
 fs.writeFileSync(dir+'/solver-balanced.json',JSON.stringify(res,null,2));expect(res.winning).toBeGreaterThan(500);expect(res.dead).toBeGreaterThan(300);
},180000);
test('actual complete histories of the currently assigned notebook catalogue',async()=>{
 await loadNotebook();for(const n of [1,601,1201,1801])await loadBookV5('book-v1-'+n);
 const p=fresh();metadata(p);const sizes:any[]=[];let moves=0;
 for(let n=0;n<notebook.length;n++){const id=notebook[n].id,rev=bookRevisionFor(id,p),game=notebookForTask(id,p)!;p.active=id;if(id.startsWith('book-v1-'))(p.bookRevisions??={})[id]=rev;startAttempt(p,id);let s=puzzleSession(game);
 for(const m of game.solution){s=commit(s,removePair(s.current.board,m.a,m.b),'pair',0);moves++;}expect(occupied(s.current.board)).toBe(0);p.sessions[id]=s;recordCompletion(p,id);
 if((n+1)%100===0||n===notebook.length-1){const before=performance.now(),raw=serializeProgress(p);sizes.push({tasks:n+1,moves,chars:raw.length,bytes:Buffer.byteLength(raw),serializeMs:Math.round(performance.now()-before)});if(n===notebook.length-1)fs.writeFileSync(dir+'/catalogue-full-save.json',raw);}}
 const final=serializeProgress(p),t=performance.now();const restored=readProgress(final);const readMs=Math.round(performance.now()-t);
 expect(restored.done.length).toBe(2496);expect(restored.sessions[notebook.at(-1)!.id].history.length).toBe(p.sessions[notebook.at(-1)!.id].history.length);
 fs.writeFileSync(dir+'/catalogue-growth.json',JSON.stringify({sizes,readMs,totalMoves:moves,done:restored.done.length},null,2));
},300000);
