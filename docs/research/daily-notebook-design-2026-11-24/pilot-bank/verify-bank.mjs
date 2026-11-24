// Run Node 22.16+ / 24, in a checkout that contains the pinned consumer commit.
// No runtime mutation; exact old source is extracted with git show.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {stripTypeScriptTypes} from 'node:module';
import {createHash} from 'node:crypto';
import {fingerprint,buildBank} from './author-model.mjs';
const ref='92ac62f938e12b617132c78bf3d2b4c132a37621';
const sha=(s,alg='sha256')=>createHash(alg).update(s).digest('hex');
const src=(p,expected)=>{const b=execFileSync('git',['show',ref+':'+p],{maxBuffer:20*1024*1024});const prefix=Buffer.from('blob '+b.length+'\0');assert.equal(sha(Buffer.concat([prefix,b]),'sha1'),expected,p);return b.toString('utf8')};
const coreText=src('src/core.ts','1b4f680c74dea2fdb778bb111d18f176c791ab34');
const puzzleText=src('src/puzzles.ts','1493bb50a6b71f11a63ea01e503b1659fcc93847');
const scratch=mkdtempSync(join(tmpdir(),'seeds-bank-'));
try {
writeFileSync(join(scratch,'core.mjs'),stripTypeScriptTypes(coreText));
const makeText=puzzleText.slice(puzzleText.indexOf('function random('),puzzleText.indexOf('export const notebook:'));
const dailyText=puzzleText.slice(puzzleText.indexOf('export function daily('),puzzleText.indexOf('export function today('));
writeFileSync(join(scratch,'daily.mjs'),"import {checkPair,removePair} from './core.mjs';\n"+stripTypeScriptTypes(makeText+dailyText));
const core=await import(pathToFileURL(join(scratch,'core.mjs')));
const {daily}=await import(pathToFileURL(join(scratch,'daily.mjs')));
const oldFirst=JSON.parse(src('src/notebook.json','ef77d106e87cd0320ef6887c4b4e39809abc1d93'));
const oldExtra=JSON.parse(src('src/notebook-extra.json','6e81195773e4d1e9c13d2bf9ea2aafd6a59d8c7a'));
const oldBooks=[...oldFirst,...oldExtra.map(([board],i)=>({id:'book-v1-'+(i+25),board:[...board].map(Number)}))];
assert.equal(oldBooks.length,2400);
const oldDaily=[];for(let d=new Date('2025-01-01T00:00:00Z');d<=new Date('2027-12-31T00:00:00Z');d.setUTCDate(d.getUTCDate()+1)){oldDaily.push(daily(d.toISOString().slice(0,10)))}
assert.equal(oldDaily.length,1095);
const bank=JSON.parse(readFileSync(new URL('./bank.json',import.meta.url),'utf8'));
const evidence={};for(const name of ['links','shift','daily'])Object.assign(evidence,JSON.parse(readFileSync(new URL('./evidence-'+name+'.json',import.meta.url),'utf8')));
const forbidden=new Set([...oldBooks,...oldDaily].map(x=>fingerprint(x.board)));
const outcomes={FOUND:0,NO_WIN_PROVEN:0,UNKNOWN:0};let safe=0,steps=0,episodes=0,order=0,controlStates=0;
function replay(b,path){for(const m of path){const [a,c]=Array.isArray(m)?m:[m.a,m.b];const r=core.checkPair(b,a,c);assert(r.ok);if(m.kind)assert.equal(r.path.kind,m.kind);b=core.removePair(b,a,c)}assert.equal(b.length,0)}
function greedy(b,last=false){let path=[];while(b.length){const ps=core.pairs(b);if(!ps.length)return null;const p=last?ps.at(-1):ps[0];path.push([p.a,p.b]);b=core.removePair(b,p.a,p.b)}return path}
function solve(b,budget=5000){const g=greedy(b)||greedy(b,true);if(g)return 'FOUND';let visits=0,cut=false;const dead=new Set();function dfs(b){if(!b.length)return true;const k=b.join('');if(dead.has(k))return false;if(visits>=budget){cut=true;return false}visits++;for(const p of core.pairs(b)){if(dfs(core.removePair(b,p.a,p.b)))return true;if(cut)return false}dead.add(k);return false}return dfs(b)?'FOUND':cut?'UNKNOWN':'NO_WIN_PROVEN'}
const keys=(b,ids)=>new Set(core.pairs(b).map(p=>[ids[p.a],ids[p.b]].sort((a,b)=>a-b).join(':')));
function advance(b,ids,p){const holes=b.slice();holes[p.a]=holes[p.b]=0;const nextIds=[];for(let i=0;i<holes.length;i+=9)if(holes.slice(i,i+9).some(Boolean))nextIds.push(...ids.slice(i,i+9).map((v,j)=>holes[i+j]?v:0));return {holes,after:core.removePair(b,p.a,p.b),nextIds}}
for(const p of bank.tasks){
 const key=fingerprint(p.board);assert(!forbidden.has(key),p.id+' canonical duplicate');forbidden.add(key);
 assert.equal(sha(p.board.join('')),p.boardSha256);assert(p.board.length<=54&&p.board.length%9===0);assert(core.occupied(p.board)>=12&&core.occupied(p.board)<=32);
 replay(p.board,p.solution);steps+=p.solution.length;
 let board=p.board,ids=board.map((v,i)=>v?i+1:0),trace=[];for(const m of p.solution){const a=advance(board,ids,m);trace.push({board,ids,move:m,...a});board=a.after;ids=a.nextIds}
 const e=evidence[p.id];assert(e,p.id);
 for(const [k,v] of Object.entries(e.episodes)){
  if(k==='flow'){replay(p.board,v.first);replay(p.board,v.last);continue}
  episodes++;const t=trace[v.step];assert.deepEqual(t.board,v.before);assert.deepEqual(t.ids,v.beforeIds);
  const before=keys(t.board,t.ids),after=keys(t.after,t.nextIds),holes=keys(t.holes,t.ids);
  if(k==='reveal'){assert.equal(t.board.length,t.after.length);assert([...after].some(x=>!before.has(x)))}
  if(k==='reading')assert.equal(t.move.kind,'reading');
  if(k==='compression'){assert(t.board.length>t.after.length);assert([...after].some(x=>!holes.has(x))||[...holes].some(x=>!after.has(x)))}
  if(k==='order'){order++;const a=advance(t.board,t.ids,v.branchB.action);assert.deepEqual(a.after,v.branchB.after);replay(t.after,v.branchA.continuation);replay(a.after,v.branchB.continuation);const other=keys(a.after,a.nextIds),common=new Set(t.nextIds.filter(x=>x&&a.nextIds.includes(x))),keep=x=>x.split(':').map(Number).every(n=>common.has(n));assert([...after].some(x=>keep(x)&&!other.has(x))||[...other].some(x=>keep(x)&&!after.has(x)))}
 }
 for(const [i,c] of Object.entries(e.controls)){controlStates++;assert.deepEqual(c.board,trace[+i].board);assert.deepEqual(c.alternatives.map(a=>a.action),core.pairs(c.board).map(p=>[p.a,p.b]));for(const a of c.alternatives){const next=core.removePair(c.board,...a.action);const actual=solve(next,a.budget);assert.equal(actual,a.outcome,p.id+' branch '+i);outcomes[actual]++;if(actual==='FOUND')replay(next,a.path);if(p.safeOpening&&+i===0)assert.equal(actual,'FOUND')}}
 if(p.safeOpening){safe++;assert(e.controls[0])}
}
assert.equal(bank.tasks.length,76);assert.equal(safe,25);assert.equal(steps,811);assert.equal(episodes,75);assert.equal(order,10);assert.equal(controlStates,77);assert.deepEqual(outcomes,{FOUND:879,NO_WIN_PROVEN:2,UNKNOWN:2});
if(process.argv.includes('--regenerate')){const short=oldBooks.filter(x=>core.occupied(x.board)>=8&&core.occupied(x.board)<=32&&x.board.length<=54);assert.equal(short.length,336);assert.deepEqual(buildBank(short,oldDaily).bank,bank)}
console.log(JSON.stringify({tasks:76,steps,episodes,order,safe,controlStates,outcomes,comparedOldBooks:oldBooks.length,comparedOldDaily:oldDaily.length},null,2));
} finally {rmSync(scratch,{recursive:true,force:true})}
