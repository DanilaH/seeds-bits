// Independent model audit of Seeds v5, 2026-11-25. Run from the repo root: node docs/research/daily-notebook-design-2026-11-24/catalogue-v5/independent-2026-11-25/audit.mjs
import { readFileSync } from "node:fs";
const files=[1,2,3,4].map(i=>`src/content-v5-books-${i}.json`).concat("src/content-v5-daily.json");
const bank=files.flatMap(path=>JSON.parse(readFileSync(path,"utf8")));
function moves(b){
 let m=[],seen=new Set(),add=(a,c)=>{if(b[a]!==b[c]&&b[a]+b[c]!==10)return;let k=a*b.length+c;if(!seen.has(k)){seen.add(k);m.push([a,c]);}};
 let prev=-1;for(let a=0;a<b.length;a++)if(b[a]){
 if(prev>=0)add(prev,a);prev=a;
 for(const [dr,dc] of [[0,1],[1,0],[1,1],[1,-1]]){let r=Math.floor(a/9)+dr,c=a%9+dc;while(c>=0&&c<9&&9*r+c<b.length){let z=9*r+c;if(b[z]){add(a,z);break;}r+=dr;c+=dc;}}
 }return m.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
}

function take(b,p,ids){let x=b.slice();x[p[0]]=x[p[1]]=0;let keep=[];for(let i=0;i<x.length;i+=9)if(x.slice(i,i+9).some(Boolean))for(let j=i;j<Math.min(i+9,x.length);j++)keep.push(j);return ids?[keep.map(i=>x[i]),keep.map(i=>ids[i])]:keep.map(i=>x[i]);}

function rng(seed){let x=seed>>>0;return ()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return (x>>>0)/4294967296;}}

function play(b,policy,seed){let rnd=rng(seed),steps=0;while(b.length){let ms=moves(b);if(!ms.length)break;let chosen;if(policy==="random")chosen=ms[Math.floor(rnd()*ms.length)];else if(policy==="scan")chosen=ms[0];else if(policy==="near"){let best=Infinity;for(let p of ms){let dist=Math.max(Math.abs(Math.floor(p[1]/9)-Math.floor(p[0]/9)),Math.abs(p[1]%9-p[0]%9));if(dist<best){best=dist;chosen=p;}}}else{let best=-Infinity;for(let p of ms){let next=take(b,p),score=(next.length===0?1000:0)+moves(next).length;if(score>best){best=score;chosen=p;}}}b=take(b,chosen);steps++;}return {win:!b.length,remaining:b.filter(Boolean).length,steps};}

function opening(b,cap=4000){let memo=new Map(),visits=0;function win(x){if(!x.length)return 1;let k=x.join("");if(memo.has(k))return memo.get(k);if(visits>=cap)return -1;visits++;let unknown=false;for(let q of moves(x)){let w=win(take(x,q));if(w===1){memo.set(k,1);return 1;}if(w===-1)unknown=true;}if(!unknown)memo.set(k,0);return unknown?-1:0;}let m=moves(b),rs=m.map(q=>win(take(b,q)));return {safe:rs.filter(x=>x===1).length,dead:rs.filter(x=>x===0).length,unknown:rs.filter(x=>x===-1).length,visits,losing:m.filter((_,i)=>rs[i]===0)};}

function solve(b,cap,memo=new Map()){let n=0;function visit(x){if(!x.length)return [];let k=x.join("");if(memo.has(k))return memo.get(k);if(++n>cap)throw 0;for(let q of moves(x)){let w=visit(take(x,q));if(w){let p=[q,...w];memo.set(k,p);return p;}}memo.set(k,null);return null;}try{let p=visit(b);return {status:p?"FOUND":"NO_WIN",p,n};}catch{return {status:"UNKNOWN",n};}}

function trace(row){let b=Array.from(row[0],Number),ids=b.map((_,i)=>i),t=[];for(let i=0;i<row[1].length;i+=2){let p=row[1].slice(i,i+2);if(!moves(b).some(q=>q[0]===p[0]&&q[1]===p[1]))throw Error("Invalid witness");t.push({b,ids,p,stable:p.map(j=>ids[j])});[b,ids]=take(b,p,ids);}if(b.length)throw Error("Incomplete witness");return t;}

function patch(b,ids,t){let path=[];for(let s of t){let p=s.stable.map(i=>ids.indexOf(i)).sort((a,b)=>a-b);if(p[0]<0)continue;if(moves(b).some(m=>m[0]===p[0]&&m[1]===p[1])){path.push(p);[b,ids]=take(b,p,ids);}}return {b,path};}

function taskSeeds(n){return Math.min(24,Math.max(4,Math.ceil(n/8)*2));}

function audit(bank,future=[]){const groups={},sizes={},early=[],hint={boards:[],certified:0,unknown:0,cases:[]};function collect(o,k,d){let s=o[k]??={boards:0,digits:0,pairs:0,seedReward:0,near:0,scan:0,mobility:0,random:0,randomRuns:0,randomRemaining:0,exactBoards:0,safe:0,dead:0,unknown:0,trapBoards:0,allSafeBoards:0,highRisk:0};s.boards++;s.digits+=d.n;s.pairs+=d.open;s.seedReward+=taskSeeds(d.n);for(let p of ["near","scan","mobility"])s[p]+=Number(d[p].win);s.random+=d.random.filter(x=>x.win).length;s.randomRuns+=d.random.length;s.randomRemaining+=d.random.reduce((x,y)=>x+y.remaining,0);if(d.exact){let e=d.exact;s.exactBoards++;for(let k of ["safe","dead","unknown"])s[k]+=e[k];s.trapBoards+=Number(e.dead>0);s.allSafeBoards+=Number(!e.dead&&!e.unknown);s.highRisk+=Number(e.dead/(e.safe+e.dead+e.unknown)>=.4);}}
 for(let i=0;i<bank.length+future.length;i++){let row=i<bank.length?bank[i]:future[i-bank.length],b=Array.from(row[0],Number),n=b.filter(Boolean).length,v=1+Math.floor(i/24),mode=i<2400?"book":i<2765?"daily":"future",group=mode!=="book"?mode:v<=10?"1–10":v<=25?"11–25":v<=50?"26–50":v<=75?"51–75":"76–100",size=n<=10?"8–10":n<=26?"12–26":n<=36?"28–36":n<=54?"38–54":n<=72?"56–72":"74–108";
 let d={n,open:moves(b).length,near:play(b,"near",i+1),scan:play(b,"scan",i+1),mobility:play(b,"mobility",i+1),random:[0,1,2].map(j=>play(b,"random",Math.imul(i+1,2654435761)+j*104729)),exact:n<=26?opening(b):null};collect(groups,group,d);collect(sizes,mode+" "+size,d);
 if(i<24)early.push({id:i+1,board:row[0],witness:row[1],n,opening:opening(b,100000),near:d.near,scan:d.scan,mobility:d.mobility,random:d.random});}
 const candidates=bank.slice(1800,2400).map((r,i)=>({r,id:1801+i})).filter(x=>x.r[0].replace(/0/g,"").length>=104).slice(0,15);
 for(let {r,id} of candidates){hint.boards.push(id);let t=trace(r),s=t[0],ms=moves(s.b).filter(q=>q[0]!==s.p[0]||q[1]!==s.p[1]);let ps=[...ms.filter(q=>q.some(x=>s.p.includes(x))).slice(0,3),...ms.filter(q=>!q.some(x=>s.p.includes(x))).filter((q,i)=>i%Math.max(1,Math.floor(ms.length/8))===0).slice(0,6)];for(let q of ps){let [b,ids]=take(s.b,q,s.ids),patched=patch(b,ids,t.slice(1));if(patched.b.length){let sol=solve(patched.b,1000);if(sol.status!=="FOUND")continue;patched.path.push(...sol.p);}hint.certified++;let w=b;for(let p of patched.path){if(!moves(w).some(m=>m[0]===p[0]&&m[1]===p[1]))throw Error("Bad alternative");w=take(w,p);}if(w.length)throw Error("Incomplete alternative");let memo=new Map(t.map(x=>[x.b.join(""),[x.p]])),result=solve(b,b.filter(Boolean).length>100?2000:50000,memo);if(result.status==="UNKNOWN"){hint.unknown++;hint.cases.push({id,board:s.b.join(""),first:q,after:b.join(""),winningSuffix:patched.path.flat(),visits:result.n,recovery:0});}}}
 return {groups,sizes,early,hint};}
console.log(JSON.stringify(audit(bank),null,2));
