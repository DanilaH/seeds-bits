// Run Node 22.16+ from a checkout of Seeds Bits with the pinned commit.
import {readFileSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {stripTypeScriptTypes} from 'node:module';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const revision='92ac62f938e12b617132c78bf3d2b4c132a37621';
const src=(p,expected)=>{let b=execFileSync('git',['show',revision+':'+p],{maxBuffer:20*1024*1024});assert.equal(createHash('sha1').update(Buffer.concat([Buffer.from('blob '+b.length+'\0'),b])).digest('hex'),expected);return b.toString()};
const tmp=mkdtempSync(join(tmpdir(),'seeds-v3-'));
try{
writeFileSync(join(tmp,'core.mjs'),stripTypeScriptTypes(src('src/core.ts','1b4f680c74dea2fdb778bb111d18f176c791ab34')));
const C=await import(pathToFileURL(join(tmp,'core.mjs')));
let p=src('src/puzzles.ts','1493bb50a6b71f11a63ea01e503b1659fcc93847');writeFileSync(join(tmp,'daily.mjs'),"import {checkPair,removePair} from './core.mjs';\n"+stripTypeScriptTypes(p.slice(p.indexOf('function random('),p.indexOf('export const notebook:'))+p.slice(p.indexOf('export function daily('),p.indexOf('export function today('))));
const {daily}=await import(pathToFileURL(join(tmp,'daily.mjs')));
const canonical=b=>{let m=new Map();return b.map(d=>{if(!d||d===5)return d;if(!m.has(d)){let v=m.size/2+1;m.set(d,v);m.set(10-d,10-v)}return m.get(d)}).join('')};
const old=[...JSON.parse(src('src/notebook.json','ef77d106e87cd0320ef6887c4b4e39809abc1d93')),...JSON.parse(src('src/notebook-extra.json','6e81195773e4d1e9c13d2bf9ea2aafd6a59d8c7a')).map(([b])=>({board:[...b].map(Number)}))];
assert.equal(old.length,2400);for(let d=new Date('2025-01-01T00:00:00Z');d<=new Date('2027-12-31T00:00:00Z');d.setUTCDate(d.getUTCDate()+1))old.push(daily(d.toISOString().slice(0,10)));
old.push(...JSON.parse(readFileSync(new URL('../pilot-bank/bank.json',import.meta.url))).tasks);
const known=new Set(old.map(x=>canonical(x.board)));
const data=readFileSync(new URL('./bank-compact.txt',import.meta.url),'utf8');
const A='0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_';let count=0,states=0,edges=0,moves=0,profiles={f:0,m:0,t:0},roleCounts={},chains=0,competition=0,compression=0,reveal=0;
const edge=(a,b)=>[a,b].sort((a,b)=>a-b).join(':');
const links=(b,ids)=>new Set(C.pairs(b).map(p=>edge(ids[p.a],ids[p.b])));
for(let line of data.trim().split('\n')){
 const [id,type,role,style,digits,route,expectedStates,expectedDead,opening]=line.split('|'),board=[...digits].map(Number),key=canonical(board);assert(!known.has(key),id+' duplicate');known.add(key);
 let memo=new Map(),nEdges=0;
 function visit(b){let k=b.join('');if(memo.has(k))return memo.get(k);let ps=C.pairs(b),win=!b.length,safe=0;for(let p of ps){nEdges++;if(visit(C.removePair(b,p.a,p.b)).win){win=true;safe++}}let r={win,safe,legal:ps.length};memo.set(k,r);return r}
 const root=visit(board),dead=[...memo.values()].filter(x=>!x.win).length;assert(root.win);assert.equal(memo.size,+expectedStates);assert.equal(dead,+expectedDead);assert.equal(root.safe+'/'+root.legal,opening);assert.equal(type,dead===0?'f':root.safe===root.legal?'m':'t');
 let b=board,ids=b.map((v,i)=>v?i+1:0),previous=new Set(),streak=0,hasChain=false,hasReveal=false,hasCompression=false,hasCompetition=false,gaps=0,reading=0,n=0;
 for(let i=0;i<route.length;i+=2){let a=A.indexOf(route[i]),c=A.indexOf(route[i+1]);let legal=C.checkPair(b,a,c);assert(legal.ok,id);let removed=edge(ids[a],ids[c]);if(previous.has(removed)){streak++;if(streak>=2)hasChain=true}else streak=0;
 const old=links(b,ids),hole=b.slice(),hi=ids.slice();hole[a]=hole[c]=hi[a]=hi[c]=0;let nb=C.removePair(b,a,c),ni=hi.filter((v,j)=>hole.slice(j-j%9,j-j%9+9).some(Boolean)),unc=links(hole,hi),next=links(nb,ni);
 previous=new Set([...next].filter(x=>!old.has(x)&&unc.has(x)));if(previous.size)hasReveal=true;if([...next].some(x=>!unc.has(x)))hasCompression=true;
 for(let p of C.pairs(b))if((p.a===a||p.b===a||p.a===c||p.b===c)&&!(p.a===Math.min(a,c)&&p.b===Math.max(a,c))&&!memo.get(C.removePair(b,p.a,p.b).join('')).win)hasCompetition=true;
 if(legal.path.kind==='reading')reading++;if(legal.path.kind==='reading'?Math.abs(a-c)>1:Math.max(Math.abs(a%9-c%9),Math.abs(Math.floor(a/9)-Math.floor(c/9)))>1)gaps++;
 b=nb;ids=ni;n++;}
 assert.equal(b.length,0,id);assert(role==='flow'?type==='f':role==='chain'?hasChain:role==='reveal'?hasReveal:role==='compression'?hasCompression:role==='competition'?hasCompetition:role==='mix'?hasReveal&&hasCompression&&gaps>=2:role==='distant'&&reading>=1&&gaps>=Math.ceil(n*.55),id+' role');
 count++;states+=memo.size;edges+=nEdges;moves+=n;profiles[type]++;roleCounts[role]=(roleCounts[role]??0)+1;chains+=+hasChain;competition+=+hasCompetition;compression+=+hasCompression;reveal+=+hasReveal;
}
assert.equal(count,120);assert.equal(states,269779);assert.equal(edges,1305355);assert.equal(moves,1032);assert.deepEqual(profiles,{f:36,m:60,t:24});assert.equal(chains,61);assert.equal(competition,59);assert.equal(compression,79);assert.equal(reveal,120);
console.log({count,states,edges,moves,profiles,roleCounts,chains,competition,compression,reveal,oldCompared:old.length});
}finally{rmSync(tmp,{recursive:true,force:true})}
