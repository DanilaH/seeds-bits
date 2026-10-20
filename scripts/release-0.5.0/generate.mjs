import { createServer } from 'vite';
import { writeFileSync } from 'node:fs';
const vite=await createServer({server:{middlewareMode:true}});
const {makePuzzle,hash}=await vite.ssrLoadModule('/src/puzzles.ts');
const {removePair,checkPair,occupied}=await vite.ssrLoadModule('/src/core.ts');
const packed=[], seen=new Set(), report=[];
// Canonicalize value renaming while preserving equality/complement relationships.
function shape(board){const groups=new Map();return board.map(v=>{if(!v)return '0';if(v===5)return 'X';const g=Math.min(v,10-v);if(!groups.has(g))groups.set(g,[groups.size+1,v]);const [n,first]=groups.get(g);return `${n}${v===first?'a':'b'}`}).join(',');}
for(let i=24;i<2400;i++){
 const volume=Math.floor(i/24), chapter=Math.floor(volume/10);
 const blocks=1+Math.floor((volume/99)**1.55*23);
 let board,solution,key;
 for(let retry=0;;retry++){
  board=[];solution=[];
  for(let block=0;block<blocks;block++){
   const seed=hash(`seeds-notebooks-v2:${i}:${retry}:${block}`);
   const count=6+(seed%11),rows=3+(seed%4);
   const p=makePuzzle('part',seed,count,rows);
   board.push(...p.board);
   solution.push(...p.solution);
  }
  key=shape(board);
  if(!seen.has(key))break;
 }
 seen.add(key);
 let b=board;
 for(const c of solution){if(!checkPair(b,c.a,c.b).ok)throw Error(`Invalid ${i}`);b=removePair(b,c.a,c.b);}
 if(occupied(b))throw Error(`Unsolved ${i}`);
 packed.push([board.join(''),solution.flatMap(c=>[c.a,c.b,c.kind==='reading'?1:0])]);
 report.push({id:`book-v1-${i+1}`,volume:volume+1,chapter:chapter+1,cells:board.length,digits:occupied(board),pairs:solution.length});
 if(i%240===0)console.log(i);
}
writeFileSync('src/notebook-extra.json',JSON.stringify(packed)+'\n');
writeFileSync('scripts/release-0.5.0/content-report.json',JSON.stringify({tasks:2400,preserved:24,uniqueNewShapes:seen.size,minDigits:Math.min(...report.map(x=>x.digits)),maxDigits:Math.max(...report.map(x=>x.digits)),maxCells:Math.max(...report.map(x=>x.cells)),volumes:Array.from({length:99},(_,i)=>{const t=report.filter(x=>x.volume===i+2);return {volume:i+2,minDigits:Math.min(...t.map(x=>x.digits)),maxDigits:Math.max(...t.map(x=>x.digits))}})},null,2)+'\n');
await vite.close();
