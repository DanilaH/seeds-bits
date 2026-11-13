import {createServer} from 'vite';
import fs from 'node:fs/promises';
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try {
 const core=await server.ssrLoadModule('/src/core.ts');
 const {searchHelp,verifyHelpProof}=await server.ssrLoadModule('/src/help-search.ts');
 const supplied=JSON.parse(await fs.readFile('fixtures/assistance/magnet-example.json','utf8'));
 const cases=[{id:'supplied',source:'synthetic supplied fixture; not a player session',start:supplied.start,actions:supplied.normal_prefix.map(pair=>({kind:'pair',pair})),board:supplied.before}];
 for(let run=1;run<=14;run++) {
  let seed=run*9973,board=core.classic(),actions=[];
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
  const targets=run<=4?[12+run*2]:run<=8?[100+(run-5)*25]:[400+(run-9)*90];
  let chosen,last;
  for(let step=0;step<900;step++){
   if(!board.length)break;
   last={start:core.classic(),actions:[...actions],board:[...board]};
   const pairs=core.pairs(board);
   if(step===targets[0] || (run>4 && board.length>=targets[0])) {chosen={start:core.classic(),actions:[...actions],board:[...board]};break;}
   if(!board.length)break;
   if(pairs.length){const p=pairs[Math.floor(random()*pairs.length)];actions.push({kind:'pair',pair:[p.a,p.b]});board=core.removePair(board,p.a,p.b);}
   else {try{board=core.addNumbers(board);actions.push({kind:'add'});}catch{break;}}
  }
  chosen ??= last;
  if(chosen)cases.push({id:'legal-qa-'+run,source:'deterministic synthetic QA gameplay, traditional start, seed '+run*9973+'; not a player session',...chosen});
 }
 // Different logical field sizes of the supplied valid position expose row/index
 // mapping costs without pretending the field was captured from a player.
 for(const size of [90,270,900])cases.push({id:'sparse-'+size,source:'synthetic padded field; not a player session',board:[...Array(size-18).fill(0),...supplied.before]});
 for(const size of [180,540,1800])cases.push({id:'dense-'+size,source:'synthetic dense performance control; not a player session',board:Array.from({length:size},(_,i)=>1+i%9)});
 const seen = new Set(cases.map(c=>c.board.join(',')));
 for(let step=1; step<=18; step++) {
  let board=core.classic(),actions=[];
  for(let n=0;n<step&&board.length;n++) {
   const available=core.pairs(board);
   if(available.length){const p=available[(step+n)%available.length];actions.push({kind:'pair',pair:[p.a,p.b]});board=core.removePair(board,p.a,p.b);}
   else {try{board=core.addNumbers(board);actions.push({kind:'add'});}catch{break;}}
  }
  if(board.length&&!seen.has(board.join(','))) {seen.add(board.join(','));cases.push({id:'prefix-'+step,source:'synthetic deterministic legal gameplay checkpoint; not a player session',start:core.classic(),actions,board});}
 }
 const output=[];
 for(const c of cases){
  const result=searchHelp(c.board,'magnet');
  if(result.proof && !verifyHelpProof(c.board,result.proof,'magnet'))throw Error(c.id);
  output.push({...c,logicalCells:c.board.length,occupied:core.occupied(c.board),ordinaryPairs:core.pairs(c.board).length,result});
 }
 await fs.mkdir('test-results/help',{recursive:true});
 await fs.writeFile('test-results/help/magnet-fixtures.json',JSON.stringify({algorithm:'bounded-help-v1',limits:{candidates:128,nodes:4000,ms:120},cases:output},null,2));
 console.log(JSON.stringify(output.map(c=>({id:c.id,cells:c.logicalCells,occupied:c.occupied,status:c.result.status,goal:c.result.proof?.goal,stats:c.result.stats})),null,2));
 if(output.length<12)throw Error('Need at least 12 independently replayable positions');
} finally {await server.close();}
