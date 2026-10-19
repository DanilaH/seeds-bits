import {stripTypeScriptTypes} from 'node:module';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
const temp=mkdtempSync(tmpdir()+'/seeds-audit-');
for(const name of ['core','puzzles']){
 const src=readFileSync(`src/${name}.ts`,'utf8').replace('"./core"','"./core.mjs"').replace('"./notebook.json"',JSON.stringify(resolve('src/notebook.json')));
 writeFileSync(`${temp}/${name}.mjs`,stripTypeScriptTypes(src));
}
const c=await import(`${temp}/core.mjs`),p=await import(`${temp}/puzzles.mjs`);
const findings={};
// Exact search with memoization; bounded only to keep pathological content from hanging the audit.
function solver(initial){const memo=new Map();let nodes=0;function solve(b){if(!c.occupied(b))return true;const key=b.join('');if(memo.has(key))return memo.get(key);if(++nodes>500000)throw Error('search limit');for(const pair of c.pairs(b))if(solve(c.removePair(b,pair.a,pair.b))){memo.set(key,true);return true}memo.set(key,false);return false}return {solve,get nodes(){return nodes}}}
findings.hints=p.notebook.map(puzzle=>{let b=puzzle.board,steps=[],badFirst=null;const s=solver(b);while(c.occupied(b)){const ps=c.pairs(b);if(!ps.length)break;const q=ps[0];const next=c.removePair(b,q.a,q.b);if(!badFirst&&!s.solve(next))badFirst={move:steps.length+1,pair:q,values:[b[q.a],b[q.b]],board:b};steps.push(q);b=next}return {id:puzzle.id,solved:!c.occupied(b),remaining:c.occupied(b),steps:steps.length,badFirst,searchNodes:s.nodes}});
let seed=20261019;const rnd=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n};
findings.longClassics=[];
for(let run=0;run<50;run++){let b=c.classic(),moves=0,adds=0,historyBytes=0,maxCells=b.length;let reason='turn-limit';for(let turn=0;turn<10000;turn++){if(!c.occupied(b)){reason='solved';break}const ps=c.pairs(b);let next;if(ps.length){const q=ps[rnd(ps.length)];next=c.removePair(b,q.a,q.b)}else{if(b.length+c.occupied(b)>1800){reason='board-limit';break}next=c.addNumbers(b)}historyBytes+=JSON.stringify({board:b,scroll:0,moves,additions:adds}).length+1;if(ps.length)moves++;else adds++;b=next;maxCells=Math.max(maxCells,b.length)}findings.longClassics.push({run,moves,adds,maxCells,remaining:c.occupied(b),historyChars:historyBytes,reason})}
findings.daily=[];for(const month of ['2026-10','2026-11','2027-01','2028-02'])for(const d of p.days(month)){const puzzle=p.daily(d);let b=puzzle.board;for(const q of puzzle.solution)b=c.removePair(b,q.a,q.b);if(b.length)throw Error(d);findings.daily.push({day:d,digits:c.occupied(puzzle.board),verified:true})}
writeFileSync('docs/audit-2026-10-19/core-results.json',JSON.stringify(findings,null,2));
console.log(JSON.stringify({hintDeadEnds:findings.hints.filter(x=>!x.solved).map(x=>({id:x.id,remaining:x.remaining,badMove:x.badFirst.move})),classics:findings.longClassics,dailyVerified:findings.daily.length}));
rmSync(temp,{recursive:true});
