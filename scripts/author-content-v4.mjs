// Seeds catalogue v4: offline authoring, not a runtime director.
// Inject the pinned core exports. All accepted fields have a replay witness.
// Exact flow classification; bounded, proven first-move outcomes + actual path risk elsewhere.
export function createAuthor(core) {
 const {checkPair,removePair,pairs,occupied}=core;
 const key=b=>b.join("");
 const canon=b=>{const m=new Map();return b.map(d=>{if(!d||d===5)return d;if(!m.has(d)){let x=m.size/2+1;m.set(d,x);m.set(10-d,10-x)}return m.get(d)}).join("")};
 const mask=b=>b.map(v=>v?1:0).join("");
 const hash=s=>{let h=2166136261;for(let c of s)h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0};
 const rng=seed=>()=>{seed=(seed+0x6d2b79f5)|0;let t=Math.imul(seed^(seed>>>15),1|seed);t=(t+Math.imul(t^(t>>>7),61|t))^t;return ((t^(t>>>14))>>>0)/4294967296};
 const live=b=>{let a=[];for(let i=0;i<b.length;i+=9)if(b.slice(i,i+9).some(Boolean))for(let j=i;j<i+9&&j<b.length;j++)a.push(j);return a};
 const edge=(a,b)=>a<b?a*64+b:b*64+a;
 const edges=(b,ids)=>new Set(pairs(b).map(p=>edge(ids[p.a],ids[p.b])));
 const A="0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_";
 function build(n,rows,style,R){
  const b=Array(rows*9).fill(0),insertions=[],use=Array(10).fill(0),I=x=>Math.floor(R()*x),pick=a=>a[I(a.length)];
  const centers=[I(b.length),I(b.length)],rowWeights=Array.from({length:rows},()=>.3+R()*1.7),colWeights=Array.from({length:9},()=>.3+R()*1.7);
  const w=b.map((_,i)=>{const r=Math.floor(i/9),c=i%9;return style===1?.2+3/(1+Math.min(...centers.map(x=>Math.abs(r-Math.floor(x/9))+Math.abs(c-x%9)))):style===2?rowWeights[r]*colWeights[c]:style===3?(c<2||c>6||r===0||r===rows-1?3:.4):1});
  function weighted(xs){let r=R()*xs.reduce((s,i)=>s+w[i],0);for(let i of xs){r-=w[i];if(r<0)return i}return xs.at(-1)}
  for(let p=0;p<n/2;p++){
   const empty=b.flatMap((d,i)=>d?[]:[i]);let a,c,ok=false;
   const test=(i,j)=>{b[i]=b[j]=5;const ids=live(b);let yes=checkPair(ids.map(k=>b[k]),ids.indexOf(i),ids.indexOf(j)).ok;b[i]=b[j]=0;return yes};
   for(let t=0;t<50;t++){a=weighted(empty);c=weighted(empty.filter(i=>i!==a));if(test(a,c)){ok=true;break}}
   if(!ok){outer:for(let i=0;i<empty.length;i++)for(let j=i+1;j<empty.length;j++)if(test(empty[i],empty[j])){a=empty[i];c=empty[j];ok=true;break outer}}
   if(!ok)return null;
   let digits=[1,2,3,4,5,6,7,8,9];if(R()<.7)digits.sort((a,b)=>use[a]-use[b]);let v=pick(digits.slice(0,R()<.65?5:9));b[a]=v;b[c]=R()<.52?v:10-v;use[b[a]]++;use[b[c]]++;insertions.push([a,c])
  }
  let ids=live(b),start=ids.map(i=>b[i]);if(start.length!==b.length)return null;let cur=start,proof=[];
  for(let [a,c] of insertions.reverse()){let i=ids.indexOf(a),j=ids.indexOf(c),p=checkPair(cur,Math.min(i,j),Math.max(i,j));if(!p.ok)return null;proof.push(p.path);let holes=cur.slice();holes[i]=holes[j]=0;ids=live(holes).map(k=>ids[k]);cur=removePair(cur,i,j)}
  return cur.length?null:{board:start,solution:proof}
 }
 function trace(board,proof){
  let b=board,ids=b.map((v,i)=>v?i+1:0),events={reveal:0,compression:0,chain:0,reading:0,gaps:0},previous=new Set(),streak=0,steps=[];
  for(let p of proof){
   let old=edges(b,ids),holes=b.slice(),hi=ids.slice();holes[p.a]=holes[p.b]=hi[p.a]=hi[p.b]=0;
   let next=removePair(b,p.a,p.b),ni=live(holes).map(i=>hi[i]),unc=edges(holes,hi),after=edges(next,ni);
   if(previous.has(edge(ids[p.a],ids[p.b])))streak++;else streak=0;
   if(streak>=2)events.chain++;
   previous=new Set([...after].filter(x=>!old.has(x)&&unc.has(x)));
   if(previous.size)events.reveal++;
   if([...after].some(x=>!unc.has(x)))events.compression++;
   if(p.kind==="reading")events.reading++;
   if(p.kind==="reading"?Math.abs(p.b-p.a)>1:Math.max(Math.abs(p.a%9-p.b%9),Math.abs(Math.floor(p.a/9)-Math.floor(p.b/9)))>1)events.gaps++;
   steps.push({b,p,next});b=next;ids=ni;
  }
  return {events,steps};
 }
 function classify(board,proof,type,role,budget=10000){
  let memo=new Map(),visits=0,cut=false;
  function win(b){if(!b.length)return true;let k=key(b);if(memo.has(k))return memo.get(k);if(++visits>budget){cut=true;return null}
   let unknown=false;for(let p of pairs(b)){let w=win(removePair(b,p.a,p.b));if(w===true){memo.set(k,true);return true}if(w===null)unknown=true}if(unknown)return null;memo.set(k,false);return false}
  let opening=pairs(board);if(opening.length<2)return null;
  if(type==="flow"){
   let seen=new Set(),n=0;
   function all(b){if(!b.length)return true;let k=key(b);if(seen.has(k))return true;if(++n>budget){cut=true;return false}let ps=pairs(b);if(!ps.length)return false;for(let p of ps)if(!all(removePair(b,p.a,p.b)))return false;seen.add(k);return true}
   if(!all(board))return null;return {safe:opening.length,opening:opening.length,states:n+1,riskStep:-1,competition:false,verification:"ALL_STATES"};
  }
  const safe=opening.map(p=>win(removePair(board,p.a,p.b)));if(safe.includes(null))return null;
  const n=safe.filter(Boolean).length;if(n<2)return null;
  if(type==="moderate"&&n!==opening.length)return null;
  if(type==="tactical"&&(n===opening.length||n/opening.length<.4))return null;
  let riskStep=type==="tactical"?0:-1,competition=false;
  let b=board;
  for(let i=0;i<proof.length;i++){let p=proof[i];if(role==="competition"||riskStep<0){for(let q of pairs(b)){if(q.a===p.a&&q.b===p.b)continue;let w=win(removePair(b,q.a,q.b));if(w===false){if(riskStep<0)riskStep=i;if(q.a===p.a||q.a===p.b||q.b===p.a||q.b===p.b)competition=true;if(role!=="competition"||competition)break}}}b=removePair(b,p.a,p.b);if(riskStep>=0&&(role!=="competition"||competition))break}
  if(riskStep<0||role==="competition"&&!competition)return null;
  return {safe:n,opening:opening.length,states:visits,riskStep,competition,verification:"FIRST_AND_RISK_PROVEN"};
 }
 function slot(index,mode){
  const p=index%24,v=Math.floor(index/24),tier=mode==="daily"?1:Math.floor(v/25);
  // A repeating *load rhythm*, not a repeat of board structures. Rotate the leading mechanic per page.
  const roleList=["reveal","chain","compression","distant","mix","competition"];
  let tactical=mode==="daily"?(index%7===5):([5,11,17,23].includes(p)||(tier>=2&&[8,20].includes(p)));
  let flow=!tactical&&([0,3,6,9,12,15,18,21].includes(p)||mode==="daily"&&index%7===3);
  const type=tactical?"tactical":flow?"flow":"moderate";
  let role=roleList[(p+v*3+Math.floor(p/6))%6];
  if(type==="flow"&&role==="competition")role="reveal";
  if(type==="flow"&&p%6===3)role="flow";
  const sizes=type==="flow"?[12,14,16,18]:tier===0?[12,14,16,18,20]:tier===1?[14,16,18,20,22]:tier===2?[14,18,20,22,24]:[16,18,20,22,24,26];
  const n=sizes[(p*3+v+Math.floor(p/6))%sizes.length];
  return {index,mode,type,role,n,rows:Math.max(Math.ceil(n/9),3+(p+v*2)%4)};
 }
 function author(s,forbidden,masks,counters={}){
  const R=rng(hash("seeds-catalogue-v4:"+s.mode+":"+s.index)),I=n=>Math.floor(R()*n);
  const bump=k=>counters[k]=(counters[k]??0)+1;
  for(let attempt=0;attempt<600;attempt++){
   bump("attempts");
   let n=s.n,rows=s.rows;
   if(attempt>=18){let sizes=[12,14,16,18,20,22,24,26].filter(x=>Math.abs(x-s.n)<=4&&(s.type!=="flow"||x<=18));n=sizes[I(sizes.length)];rows=Math.max(Math.ceil(n/9),3+I(4))}
   if(attempt>=80){n=[12,14,16,18][I(4)];rows=3+I(4)}
   let style=I(4),x=build(n,rows,style,R);
   if(!x||new Set(x.board.filter(Boolean)).size<4){bump("geometry");continue}
   let k=canon(x.board),m=mask(x.board);if(forbidden.has(k)||masks.has(m)){bump("duplicate");continue}
   let t=trace(x.board,x.solution),e=t.events;
   const hasRole=role=>role==="flow"?s.type==="flow":role==="distant"?e.gaps>=Math.ceil(x.solution.length*.5)&&e.reading>0:role==="mix"?e.reveal&&e.compression&&e.gaps>=2:role==="competition"?s.type!=="flow":e[role]>0;
   let role=s.role;
   if(attempt>=160&&!hasRole(role)){role=["chain","mix","compression","distant","reveal","flow"].find(hasRole);if(role)bump("roleRelaxation")}
   if(!role||!hasRole(role)){bump("role");continue}
   let c=classify(x.board,x.solution,s.type,role,n<=18?10000:15000);
   if(!c){bump("profile");continue}
   forbidden.add(k);masks.add(m);bump("accepted");
   return [x.board.join(""),x.solution.map(p=>A[p.a]+A[p.b]).join(""),s.type,role,style,n,rows,c.safe,c.opening,c.riskStep,c.verification,attempt+1,s.role,c.states];
  }
  throw Error("Unfilled "+JSON.stringify(s));
 }
 return {author,slot,canon,mask,build,trace,classify,hash,rng};
}
