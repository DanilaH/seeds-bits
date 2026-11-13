// Synthetic current-position comparison. No player demand/revenue inference.
import {createServer} from 'vite';
import fs from 'node:fs/promises';
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try {
 const core=await server.ssrLoadModule('/src/core.ts');
 const {searchHelp,HELP_LIMITS}=await server.ssrLoadModule('/src/help-search.ts');
 const fixtures=JSON.parse(await fs.readFile('test-results/help/magnet-fixtures.json','utf8')).cases;
 const cases=[{id:'plan-three-step-clear',source:'synthetic chosen goal; not a player session',board:[5,5,0,0,0,0,0,0,0,7,3,2,8]},...fixtures];
 const rows=b=>Math.ceil(b.length/9),result=[];
 for(const c of cases){
  const search=searchHelp(c.board,'plan');let baseline=[...c.board],path=[];
  for(let step=0;step<3;step++){const p=core.pairs(baseline)[0];if(!p)break;path.push([p.a,p.b]);baseline=core.removePair(baseline,p.a,p.b);}
  let planned=[...c.board];
  for(const p of search.proof?.path??[]){if(!core.checkPair(planned,...p).ok)throw Error(c.id+' invalid plan step');planned=core.removePair(planned,...p);}
  const goal=b=>({clear:!core.occupied(b),rowsCleared:rows(c.board)-rows(b),pairsRemoved:(core.occupied(c.board)-core.occupied(b))/2});
  if(search.proof && !(search.proof.goal==='clear'?goal(planned).clear:goal(planned).rowsCleared>0))throw Error(c.id+' unmet goal');
  result.push({id:c.id,source:c.source,board:c.board,logicalCells:c.board.length,ordinary:{path,...goal(baseline)},plan:{...search,...(search.proof?goal(planned):{})}});
 }
 const found=result.filter(r=>r.plan.status==='found');
 const summary={cases:result.length,found:found.length,unknown:result.filter(r=>r.plan.status==='unknown').length,unknownShare:result.filter(r=>r.plan.status==='unknown').length/result.length,notFound:result.filter(r=>r.plan.status==='not_found').length,goalImprovedOverFirstAvailable:found.filter(r=>r.plan.clear&&!r.ordinary.clear||r.plan.rowsCleared>r.ordinary.rowsCleared).length};
 await fs.writeFile('test-results/help/plan-comparison.json',JSON.stringify({method:'bounded search from current synthetic board; independently replayed with real core; ordinary available[0] repeated at most 3 times',limits:HELP_LIMITS,summary,commercialConclusion:'Unknown. This synthetic set neither measures demand nor proves incremental revenue/retention; equal outcomes are not a plan advantage.',cases:result},null,2));console.log(JSON.stringify(summary));
}finally{await server.close();}
