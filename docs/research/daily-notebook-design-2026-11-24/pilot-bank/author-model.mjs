// Deterministic offline candidate authoring; model independently matches Seeds rules.
function assert(ok,msg){if(!ok)throw Error(msg);}

function hash(s){let h=2166136261;for(const c of s)h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;}

function sha256(s){
 const rotr=(v,n)=>(v>>>n)|(v<<(32-n));const K=[],H=[];let p=2;
 while(K.length<64){let prime=true;for(let i=2;i*i<=p;i++)if(p%i===0){prime=false;break;}if(prime){if(H.length<8)H.push((Math.sqrt(p)%1*4294967296)>>>0);K.push((Math.cbrt(p)%1*4294967296)>>>0);}p++;}
 const a=Array.from(s,c=>c.charCodeAt(0));let n=a.length*8;a.push(128);while(a.length%64!==56)a.push(0);a.push(0,0,0,0,(n>>>24)&255,(n>>>16)&255,(n>>>8)&255,n&255);
 for(let o=0;o<a.length;o+=64){let W=[];for(let i=0;i<16;i++)W.push((a[o+i*4]<<24)|(a[o+i*4+1]<<16)|(a[o+i*4+2]<<8)|a[o+i*4+3]);for(let i=16;i<64;i++){const x=W[i-15],y=W[i-2];W[i]=(W[i-16]+(rotr(x,7)^rotr(x,18)^(x>>>3))+W[i-7]+(rotr(y,17)^rotr(y,19)^(y>>>10)))|0;}
 let [a0,b,c,d,e,f,g,h]=H;
 for(let i=0;i<64;i++){const t1=(h+(rotr(e,6)^rotr(e,11)^rotr(e,25))+((e&f)^(~e&g))+K[i]+W[i])|0,t2=((rotr(a0,2)^rotr(a0,13)^rotr(a0,22))+((a0&b)^(a0&c)^(b&c)))|0;h=g;g=f;f=e;e=(d+t1)|0;d=c;c=b;b=a0;a0=(t1+t2)|0;}
 [a0,b,c,d,e,f,g,h].forEach((v,i)=>H[i]=(H[i]+v)|0);
 }return H.map(v=>(v>>>0).toString(16).padStart(8,"0")).join("");
}

function rng(seed){return ()=>{seed|=0;seed=(seed+0x6d2b79f5)|0;let t=Math.imul(seed^(seed>>>15),1|seed);t=(t+Math.imul(t^(t>>>7),61|t))^t;return ((t^(t>>>14))>>>0)/4294967296;};}

function check(board,a,b){if(a===b||!board[a]||!board[b]||(board[a]!==board[b]&&board[a]+board[b]!==10))return null;const lo=Math.min(a,b),hi=Math.max(a,b),dr=Math.floor(hi/9)-Math.floor(lo/9),dc=hi%9-lo%9,step=dr===0?1:dc===0?9:dr===Math.abs(dc)?9+Math.sign(dc):0;if(step){let ok=true;for(let i=lo+step;i<hi;i+=step)if(board[i]){ok=false;break;}if(ok)return "straight";}for(let i=lo+1;i<hi;i++)if(board[i])return null;return "reading";}

function pairs(board){const r=[],seen=new Set();function add(a,b){let k=a*64+b;if(seen.has(k))return;seen.add(k);let kind=check(board,a,b);if(kind)r.push({a,b,kind});}let prev=-1;for(let a=0;a<board.length;a++)if(board[a]){if(prev>=0)add(prev,a);prev=a;for(const [dy,dx] of [[0,1],[1,0],[1,-1],[1,1]]){let y=Math.floor(a/9)+dy,x=a%9+dx;while(x>=0&&x<9&&y*9+x<board.length){let b=y*9+x;if(board[b]){add(a,b);break;}y+=dy;x+=dx;}}}return r.sort((x,y)=>x.a-y.a||x.b-y.b);}

function allPairs(board){let a=[];for(let i=0;i<board.length;i++)if(board[i])for(let j=i+1;j<board.length;j++)if(board[j]){let k=check(board,i,j);if(k)a.push({a:i,b:j,kind:k});}return a;}

function occ(b){return b.filter(Boolean).length;}

function compact(b){let result=[];for(let i=0;i<b.length;i+=9){const row=b.slice(i,i+9);if(row.some(Boolean))result.push(...row);}return result;}

function remove(b,a,c){assert(check(b,a,c),"illegal move");let next=b.slice();next[a]=next[c]=0;return compact(next);}

function geometry(a,b,kind){let dr=Math.floor(b/9)-Math.floor(a/9),dc=b%9-a%9;return kind==="reading"?"reading":dr===0?"horizontal":dc===0?"vertical":"diagonal";}

function make(seed,count,rows,recipe="legacy"){
 const rand=rng(seed),board=Array(rows*9).fill(0),order=[];
 for(let p=0;p<count;p++){
  let candidates=[];for(let a=0;a<board.length;a++)if(!board[a])for(let b=a+1;b<board.length;b++)if(!board[b])candidates.push([a,b]);
  let chosen;
  let preferred=[];
  if(recipe!=="legacy"&&recipe!=="uniform"&&rand()<.66)preferred=candidates.filter(([a,b])=>{let dr=Math.floor(b/9)-Math.floor(a/9),dc=b%9-a%9;return recipe==="horizontal"?dr===0:recipe==="vertical"?dc===0:recipe==="diagonal"?dr===Math.abs(dc):recipe==="edge"?dr>0&&dc<0:Math.max(dr,Math.abs(dc))>1;});
  for(const list of [preferred,candidates]){while(list.length){const index=Math.floor(rand()*list.length),[a,b]=list[index];list[index]=list[list.length-1];list.pop();board[a]=board[b]=5;let ids=board.map((_,i)=>i).filter(i=>board.slice(Math.floor(i/9)*9,Math.floor(i/9)*9+9).some(Boolean));let ok=check(ids.map(i=>board[i]),ids.indexOf(a),ids.indexOf(b));board[a]=board[b]=0;if(ok){chosen=[a,b];break;}}if(chosen)break;}
  if(!chosen)break;const[a,b]=chosen,v=1+Math.floor(rand()*9);board[a]=v;board[b]=rand()<.5?v:10-v;order.push([a,b]);
 }
 let ids=board.map((_,i)=>i).filter(i=>board.slice(Math.floor(i/9)*9,Math.floor(i/9)*9+9).some(Boolean)),initial=ids.map(i=>board[i]),work=initial.slice(),solution=[];
 for(const[oa,ob]of order.reverse()){const a=ids.indexOf(oa),b=ids.indexOf(ob),kind=check(work,a,b);assert(kind,"construction");solution.push({a,b,kind});const blank=work.slice();blank[a]=blank[b]=0;ids=ids.filter((_,i)=>blank.slice(Math.floor(i/9)*9,Math.floor(i/9)*9+9).some(Boolean));work=remove(work,a,b);}
 assert(work.length===0,"not cleared");return {board:initial,solution};
}

function fingerprint(board){const labels=new Map();return board.map(d=>{if(!d||d===5)return d;if(!labels.has(d)){const v=labels.size/2+1;labels.set(d,v);labels.set(10-d,10-v);}return labels.get(d);}).join("");}

function similarity(a,b){if(a.length!==b.length)return 0;let n=0,m=0;for(let i=0;i<a.length;i++)if(a[i]!=="0"||b[i]!=="0"){n++;if(a[i]===b[i])m++;}return m/(n||1);}

function greedy(b,last=false){let work=b.slice(),path=[];while(work.length){let ps=pairs(work);if(!ps.length)return null;let p=last?ps.at(-1):ps[0];path.push([p.a,p.b]);work=remove(work,p.a,p.b);}return path;}

function solve(board,budget=5000){const g=greedy(board)||greedy(board,true);if(g)return {outcome:"FOUND",path:g,visits:0,budget,method:"greedy"};let visits=0,dead=new Set(),cut=false;function dfs(b){if(!b.length)return [];let k=b.join("");if(dead.has(k))return null;if(visits>=budget){cut=true;return null;}visits++;for(let p of pairs(b)){let r=dfs(remove(b,p.a,p.b));if(r)return [[p.a,p.b],...r];if(cut)return null;}dead.add(k);return null;}
 let path=dfs(board);return path?{outcome:"FOUND",path,visits,budget,method:"search"}:{outcome:cut?"UNKNOWN":"NO_WIN_PROVEN",visits,budget,method:"search"};
}

function stableEdges(board,ids){const m=new Map();for(const p of pairs(board)){const k=[ids[p.a],ids[p.b]].sort((a,b)=>a-b).join(":");m.set(k,{stableIds:k.split(":").map(Number),positions:[p.a,p.b],kind:p.kind,direction:geometry(p.a,p.b,p.kind)});}return m;}

function step(board,ids,p){let holes=board.slice();holes[p.a]=holes[p.b]=0;let remain=ids.slice();remain[p.a]=remain[p.b]=0;const after=compact(holes),nextIds=compact(remain);assert(after.length===nextIds.length,"ids");const beforeEdges=stableEdges(board,ids),holeEdges=stableEdges(holes,ids),afterEdges=stableEdges(after,nextIds);let removedRows=[];for(let i=0;i<holes.length;i+=9)if(!holes.slice(i,i+9).some(Boolean))removedRows.push(i/9);const revealed=[...afterEdges].filter(([k])=>!beforeEdges.has(k)).map(([,v])=>v),compressionNew=[...afterEdges].filter(([k])=>!holeEdges.has(k)).map(([,v])=>v),compressionLost=[...holeEdges].filter(([k])=>!afterEdges.has(k)).map(([,v])=>v);return {before:board.slice(),beforeIds:ids.slice(),action:p,after,afterIds:nextIds,removedRows,revealed:removedRows.length?[]:revealed,compressionNew,compressionLost,holes};}

function trace(puzzle){let b=puzzle.board.slice(),ids=b.map((x,i)=>x?i+1:0),steps=[];for(let p of puzzle.solution){assert(check(b,p.a,p.b)===p.kind,"path kind");const t=step(b,ids,p);steps.push(t);b=t.after;ids=t.afterIds;}assert(!b.length,"witness not cleared");return steps;}

function orderEvidence(trace){for(let i=1;i<Math.max(2,Math.floor(trace.length*.7));i++){const t=trace[i];if(!t)continue;const a=t.action,actual=stableEdges(t.after,t.afterIds);for(const p of pairs(t.before)){if(p.a===a.a&&p.b===a.b)continue;let alt=step(t.before,t.beforeIds,p),edges=stableEdges(alt.after,alt.afterIds),common=new Set(t.afterIds.filter(x=>x&&alt.afterIds.includes(x))),allowed=v=>v.stableIds.every(x=>common.has(x));let gained=[...actual].filter(([k,v])=>allowed(v)&&!edges.has(k)).map(([,v])=>v),lost=[...edges].filter(([k,v])=>allowed(v)&&!actual.has(k)).map(([,v])=>v);if(!gained.length&&!lost.length)continue;let result=solve(alt.after);if(result.outcome!=="FOUND")continue;return {step:i,before:t.before,beforeIds:t.beforeIds,branchA:{action:a,after:t.after,afterIds:t.afterIds,continuation:trace.slice(i+1).map(x=>[x.action.a,x.action.b])},branchB:{action:p,after:alt.after,afterIds:alt.afterIds,continuation:result.path,method:result.method,visits:result.visits,budget:result.budget},onlyAfterA:gained,onlyAfterB:lost};}}return null;}

function probe(b){return pairs(b).map(p=>({action:[p.a,p.b],...solve(remove(b,p.a,p.b))}));}

function describe(puzzle){const steps=trace(puzzle),early=steps.filter((_,i)=>i<Math.ceil(steps.length*.75)),reveal=early.map((t,i)=>({...t,step:i})).filter(t=>t.revealed.length),reading=early.map((t,i)=>({...t,step:i})).filter(t=>t.action.kind==="reading"),compression=early.map((t,i)=>({...t,step:i})).filter(t=>t.compressionNew.length||t.compressionLost.length);return {steps,reveal,reading,compression,metrics:{occupied:occ(puzzle.board),logical:puzzle.board.length,openingPairs:pairs(puzzle.board).length,firstClear:!!greedy(puzzle.board),lastClear:!!greedy(puzzle.board,true),reveal:reveal.length,reading:reading.length,compression:compression.length,gaps:steps.filter(t=>t.action.kind==="reading"?t.action.b-t.action.a>1:Math.max(Math.floor(t.action.b/9)-Math.floor(t.action.a/9),Math.abs(t.action.b%9-t.action.a%9))>1).length}};}

function plans(){
 const pages=[
 ["links",1,["reveal","reveal","reveal","flow","reveal","reveal"],[12,16,18,12,20,24]],
 ["links",2,["reading","reading","reading","flow","reading","reading"],[14,18,20,12,22,24]],
 ["links",3,["reveal","reading","reveal+reading","flow","reading","reveal+reading"],[16,20,22,14,24,26]],
 ["links",4,["reveal+reading","reading","reveal+reading","flow","reveal+reading","reveal+reading"],[18,24,26,16,28,32]],
 ["shift",1,["compression","compression","compression","flow","compression","compression"],[12,16,18,12,20,24]],
 ["shift",2,["compression","compression","reveal","flow","compression","compression+reveal"],[16,20,24,14,26,28]],
 ["shift",3,["order","order","order","flow","flow","order"],[16,20,22,16,24,24]],
 ["shift",4,["compression","order+compression","reading","flow","compression+reading","compression+reading+reveal"],[20,24,24,16,28,32]]
 ];let out=[];
 for(const[collection,page,roles,sizes]of pages)for(let i=0;i<6;i++)out.push({id:`book-v2-${collection}-${(page-1)*6+i+1}`,mode:"notebook",collection,page,position:(page-1)*6+i+1,size:sizes[i],roles:roles[i].split("+"),safe:i===0||roles[i]==="flow",control:i===5,direction:collection==="links"&&page===1?["horizontal","vertical","diagonal",null,"reading",null][i]:null});
 const weeks=[["flow","reveal","reading","flow","order","reveal+reading","compression"],["flow","compression","order","flow","reveal","compression+reading","reading"],["flow","reading","reveal","flow","compression","order+reveal","order"],["flow","order","compression","flow","reading","compression+reveal+reading","reveal"]];
 for(let w=0;w<4;w++)for(let i=0;i<7;i++){const role=weeks[w][i];out.push({id:`daily-pilot-v2-${String(w*7+i+1).padStart(2,"0")}`,mode:"daily",week:w+1,position:w*7+i+1,size:w===0?24:[16,24,24,16,24,32,24][i],roles:role.split("+"),safe:role==="flow",control:false,direction:null});}return out;
}

function buildBank(oldBooks,oldDaily){
 const existing=new Map(),allOld=[];for(const p of [...oldBooks,...oldDaily]){let key=fingerprint(p.board);existing.set(key,p.id);allOld.push({id:p.id,key});}
 const chosen=[],used=new Set(),report={attempts:0,rejections:{},slots:[],oldBooks:oldBooks.length,oldDaily:oldDaily.length},recipes=["uniform","horizontal","vertical","diagonal","edge","spaced"],allEvidence={};
 const reject=k=>{report.rejections[k]=(report.rejections[k]||0)+1;};
 for(const s of plans()){
  let selected=[],attempts=0;for(let attempt=0;attempt<420&&selected.length<8;attempt++){attempts++;report.attempts++;const seed=hash(`seeds-content-pilot-v2:${s.id}:${attempt}`),rand=rng(seed^0xabc37513),minRows=Math.ceil(s.size/9),rows=minRows+Math.floor(rand()*(7-minRows)),recipe=recipes[Math.floor(rand()*recipes.length)];const p=make(seed,s.size/2,rows,recipe);if(occ(p.board)!==s.size||p.board.length>54||new Set(p.board.filter(Boolean)).size<5){reject("size_or_digit_diversity");continue;}
   const key=fingerprint(p.board);if(existing.has(key)||used.has(key)||selected.some(x=>x.key===key)){reject("canonical_duplicate");continue;}
   const d=describe(p);if(d.metrics.openingPairs<3||!pairs(p.board).some(x=>x.b<27&&x.kind==="straight"&&[1,8,9,10].includes(x.b-x.a))){reject("opening");continue;}
   if(s.roles.includes("flow")&&(!d.metrics.firstClear||!d.metrics.lastClear)){reject("flow");continue;}
   if(s.roles.includes("reveal")&&!d.reveal.some(t=>t.revealed.some(x=>!s.direction||x.direction===s.direction))){reject("reveal");continue;}
   if(s.roles.includes("reading")&&!d.reading.length){reject("reading");continue;}
   if(s.roles.includes("compression")&&!d.compression.some(t=>t.compressionNew.length||t.compressionLost.length)){reject("compression");continue;}
   let ord=s.roles.includes("order")?orderEvidence(d.steps):null;if(s.roles.includes("order")&&!ord){reject("order");continue;}
   let first=s.safe?probe(p.board):null;if(first&&first.some(b=>b.outcome!=="FOUND")){reject("intro_safety");continue;}
   const neighbors=[...allOld,...chosen.map(x=>({id:x.s.id,key:x.key}))];let near={id:null,similarity:0};for(let x of neighbors){let v=similarity(key,x.key);if(v>near.similarity)near={id:x.id,similarity:v};}
   let recent=chosen.slice(-5).filter(x=>x.s.mode===s.mode),recentSim=Math.max(0,...recent.map(x=>similarity(key,x.key))),score=-near.similarity*6-recentSim*9;
   if(recent.length){const prev=recent.at(-1);score+=(p.board.length!==prev.p.board.length?1.3:0)+(recipe!==prev.recipe?.3:0);}
   if(s.roles.includes("reveal"))score+=Math.min(4,Math.max(...d.reveal.map(t=>t.revealed.length)))*.4;
   if(s.roles.includes("compression"))score+=Math.min(3,d.compression.length)*.4;
   if(s.roles.includes("reading"))score+=Math.min(3,d.reading.length)*.3;
   if(s.roles.includes("flow"))score-=d.metrics.compression*.4;
   selected.push({s,p,d,key,seed,recipe,rows,attempt,ord,first,near,score});
  }
  assert(selected.length>0,"no eligible candidate "+s.id);selected.sort((a,b)=>b.score-a.score||a.attempt-b.attempt);let win=selected[0];chosen.push(win);used.add(win.key);report.slots.push({id:s.id,attempts,eligible:selected.length,selectedAttempt:win.attempt});
 }
 let dailyControl=new Set();for(const family of ["flow","reveal","reading","compression","order"]){let xs=chosen.filter(x=>x.s.mode==="daily"&&x.s.roles[0]===family);assert(xs.length>=2,"daily control coverage");for(const x of [xs[0],xs.at(-1)])dailyControl.add(x.s.id);}
 const rows=chosen.map(x=>{
  const {s,p,d,key,seed,recipe,rows,ord,first,near}=x;
  const tag=role=>`seeds-content-${role}`;
  const episodes={};
  if(s.roles.includes("reveal"))episodes.reveal=d.reveal.find(t=>t.revealed.some(v=>!s.direction||v.direction===s.direction));
  if(s.roles.includes("reading"))episodes.reading=d.reading[0];
  if(s.roles.includes("compression"))episodes.compression=d.compression.find(t=>t.compressionNew.length)||d.compression[0];
  if(ord)episodes.order=ord;
  if(s.roles.includes("flow"))episodes.flow={first:greedy(p.board),last:greedy(p.board,true)};
  let controls={};if(s.control||dailyControl.has(s.id)){const idx=[...new Set([0,Math.floor(d.steps.length/2),d.steps.length-2])];for(const i of idx)controls[i]={board:d.steps[i].before,alternatives:i===0&&first?first:probe(d.steps[i].before)};}
  if(first&&!controls[0])controls[0]={board:p.board,alternatives:first};
  allEvidence[s.id]={episodes,controls};
  return {id:s.id,mode:s.mode,...(s.mode==="notebook"?{collection:s.collection,page:s.page,position:s.position}:{week:s.week,position:s.position}),revision:"pilot-bank-v2.1",board:p.board,boardSha256:sha256(p.board.join("")),solution:p.solution,leadFamily:tag(s.roles[0]),additionalFamilies:s.roles.slice(1).map(tag),safeOpening:s.safe,metrics:d.metrics,source:{constructor:"offline-reverse-v2.1",seed,rows,recipe,attempt:x.attempt},fingerprint:key,closestPrior:{id:near.id,similarity:near.similarity}};
 });
 let outcomes={FOUND:0,NO_WIN_PROVEN:0,UNKNOWN:0},paths=0,actions=0;
 function replay(b,path){let w=b.slice();for(const move of path){let [a,c]=Array.isArray(move)?move:[move.a,move.b];assert(JSON.stringify(pairs(w))===JSON.stringify(allPairs(w)),"pair enumeration disagreement");assert(check(w,a,c),"invalid replay");w=remove(w,a,c);actions++;}assert(!w.length,"incomplete path");paths++;}
 for(const p of rows){replay(p.board,p.solution);let e=allEvidence[p.id];if(e.episodes.order){let t=e.episodes.order;replay(t.branchA.after,t.branchA.continuation);replay(t.branchB.after,t.branchB.continuation);}for(const c of Object.values(e.controls))for(const a of c.alternatives){outcomes[a.outcome]++;if(a.outcome==="FOUND")replay(remove(c.board,...a.action),a.path);}}
 report.verification={paths,actions,branchOutcomes:outcomes,safeOpenings:rows.filter(x=>x.safeOpening).length,notebookControls:chosen.filter(x=>x.s.control).length,dailyControls:dailyControl.size,newCanonicalCount:used.size,canonicalDuplicates:0};
 return {bank:{schema:"seeds-content-pilot-bank-v2",revision:"pilot-bank-v2.1",activationDate:null,notebooks:[{id:"links",title:"Новые связи",tasks:rows.filter(x=>x.collection==="links").map(x=>x.id)},{id:"shift",title:"Поле меняется",tasks:rows.filter(x=>x.collection==="shift").map(x=>x.id)}],daily:rows.filter(x=>x.mode==="daily").map(x=>x.id),tasks:rows},report,evidence:allEvidence};
}
export {buildBank,make,hash,fingerprint,check,pairs,remove,sha256,probe};
