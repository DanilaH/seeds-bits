// Independent replay of recorded search outputs. Does not import the searcher or its validator.
import {createServer} from 'vite';
import fs from 'node:fs/promises';
const path=process.argv[2]??'test-results/help/magnet-fixtures.json';
const data=JSON.parse(await fs.readFile(path,'utf8'));
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
const results=[];
try {
 const {checkPair,pairs,removePair,addNumbers}=await server.ssrLoadModule('/src/core.ts');
 const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 const assert=(value,message)=>{if(!value)throw Error(message);};
 const compact=(board,ids,a,b)=>{
  const blank=[...board];blank[a]=blank[b]=0;const next=[],origins=[];
  for(let row=0;row<blank.length;row+=9)if(blank.slice(row,row+9).some(Boolean)){next.push(...blank.slice(row,row+9));origins.push(...ids.slice(row,row+9));}
  return {board:next,ids:origins};
 };
 for(const c of data.cases){
  assert(c.source.includes('not a player session'),'Unlabelled synthetic evidence');
  if(c.start){let board=[...c.start];for(const a of c.actions){if(a.kind==='pair'){assert(checkPair(board,...a.pair).ok,c.id+' illegal prefix');board=removePair(board,...a.pair);}else board=addNumbers(board);}assert(equal(board,c.board),c.id+' prefix mismatch');}
  const proof=c.result.proof;
  if(c.result.status!=='found'){assert(!proof,c.id+' unproven offer');results.push({id:c.id,status:c.result.status,passed:true});continue;}
  const [a,b]=proof.pair, before=c.board;
  assert(a!==b&&before[a]&&before[b]&&(before[a]===before[b]||before[a]+before[b]===10),c.id+' incompatible pair');
  assert(!checkPair(before,a,b).ok,c.id+' ordinary pair sold');
  let state=compact(before,Array.from(before,(_,i)=>i),a,b);
  assert(equal(state.board,proof.after),c.id+' incorrect special transition');
  const opened=pairs(state.board).filter(p=>!checkPair(before,state.ids[p.a],state.ids[p.b]).ok).map(p=>[state.ids[p.a],state.ids[p.b]].sort((a,b)=>a-b).join(':'));
  let used=false;
  for(const pair of proof.path){assert(checkPair(state.board,...pair).ok,c.id+' illegal continuation');used ||= opened.includes(pair.map(i=>state.ids[i]).sort((a,b)=>a-b).join(':'));const next=compact(state.board,state.ids,...pair);assert(equal(next.board,removePair(state.board,...pair)),c.id+' compaction mismatch');state=next;}
  assert(proof.path.length<=3,c.id+' excessive path');
  assert(!pairs(before).length||used,c.id+' no causally opened pair used');
  assert(proof.goal==='clear'?!state.board.some(Boolean):proof.goal==='row'?Math.ceil(state.board.length/9)<Math.ceil(before.length/9):!pairs(before).length&&pairs(proof.after).length>0,c.id+' goal not reached');
  results.push({id:c.id,status:'found',passed:true,goal:proof.goal});
 }
 assert(results.length>=12,'Fewer than twelve cases');
 await fs.writeFile('test-results/help/independent-replay.json',JSON.stringify({method:'real core; separate replay implementation; no search/validator imports',results},null,2));
 console.log(JSON.stringify({cases:results.length,passed:results.filter(r=>r.passed).length,offers:results.filter(r=>r.status==='found').length}));
} finally {await server.close();}
