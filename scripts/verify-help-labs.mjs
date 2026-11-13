// Independently replay lab content with ordinary core rules; synthetic evidence only.
import {createServer} from 'vite';import fs from 'node:fs/promises';
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try{
 const c=await server.ssrLoadModule('/src/core.ts'),{searchShuffle}=await server.ssrLoadModule('/src/shuffle-lab.ts');
 const tasks=JSON.parse(await fs.readFile('fixtures/lab/trials.json','utf8')),results=[];
 for(const t of tasks){let board=[...t.board],adds=0;for(const a of t.witness){if(a.kind==='add'){if(c.pairs(board).length)throw Error('Illegal Add '+t.id);board=c.addNumbers(board);adds++;}else{if(!c.checkPair(board,...a.pair).ok)throw Error('Illegal pair '+t.id);board=c.removePair(board,...a.pair);}}if(c.occupied(board)||adds>2)throw Error('Unproven trial '+t.id);results.push({id:t.id,source:'handpicked synthetic QA content; not a player session',board:t.board,witness:t.witness,adds,goal:'clear',passed:true});}
 const before=JSON.parse(await fs.readFile('fixtures/assistance/magnet-example.json','utf8')).before,result=searchShuffle(before),proof=result.proof;
 if(result.status!=='found'||!proof)throw Error('No shuffle');
 const multiset=b=>b.filter(Boolean).sort((a,b)=>a-b).join(',');
 if(multiset(before)!==multiset(proof.after)||proof.after.length!==c.occupied(before)||proof.after.includes(0)||!c.checkPair(proof.after,...proof.pair).ok)throw Error('Invalid shuffle');
 const shuffle={source:'supplied synthetic board; not a player session',width:9,...result,passed:true};
 await fs.mkdir('test-results/help',{recursive:true});await fs.writeFile('test-results/help/lab-proof.json',JSON.stringify({method:'real ordinary core; independent path and multiset replay',trials:results,shuffle,comparison:{magnet:'Removes two selected digits and preserves the remaining geometry except normal empty-row compaction.',shuffle:'Preserves all six digits but compacts holes and changes their positions; preview explicitly exposes that disruption.',understandability:'Not tested on players; no audience value or monetary conclusion.'}},null,2));console.log(JSON.stringify({trials:results.length,shuffle:result.status,passed:true}));
}finally{await server.close();}
