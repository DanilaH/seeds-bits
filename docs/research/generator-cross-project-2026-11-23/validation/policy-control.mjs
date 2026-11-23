import { writeFileSync } from 'node:fs';
import { core, generator, manifest, digest } from './load-product.mjs';

// Predeclared control set: no fixture selection, tuning, or seed replacement.
// These policies are deliberately simple order controls, not player skill models.
const design = {
  sourceRef: manifest.ref,
  kind: 'ACTUAL_PRODUCT_TS_EXECUTION_WITH_RESEARCH_POLICIES',
  runtime: process.version,
  seeds: {from: 10000, through: 10099, freshRunPerSeedAndLevel: true},
  levels: [0, 1, 2],
  policies: ['first_legal', 'last_legal', 'deterministic_random_legal'],
  maximumAdds: 2,
  randomPolicy: 'xorshift32, initial state = (seed XOR ((level+1)*0x9e3779b9)) unsigned; choose state modulo legal pair count',
  hypothesis: 'Check whether dependence on move order persists outside seeds 0..999 and whether one greedy policy can stand for all play.',
  limitations: [
    'Seeds were not used to select the contrast fixtures or tune generation; there is no new generator treatment to validate.',
    'Three order policies are not human player segments or increasing skill levels.',
    'A block after two Adds is a policy outcome within this audit budget, not a proof of game loss or unsolvability.',
    'Random policy uses one deterministic trajectory per board, not a distribution over all orders.',
    'Node execution does not measure Android latency or human completion time.'
  ]
};
writeFileSync(new URL('policy-design.json', import.meta.url), JSON.stringify(design, null, 2)+'\n');

function play(initial, policy, seed, level) {
  let board=[...initial], adds=0, removals=0;
  let state=(seed ^ Math.imul(level+1,0x9e3779b9))>>>0;
  while (core.occupied(board)) {
    if (removals>1000) throw new Error('Unexpected route length');
    const legal=core.pairs(board);
    if (legal.length) {
      let index=0;
      if (policy==='last_legal') index=legal.length-1;
      if (policy==='deterministic_random_legal') {
        state^=state<<13; state^=state>>>17; state^=state<<5; state>>>=0;
        index=state%legal.length;
      }
      const {a,b}=legal[index];
      board=core.removePair(board,a,b); removals++;
    } else if (adds<design.maximumAdds) {
      board=core.addNumbers(board); adds++;
    } else break;
  }
  return {outcome:core.occupied(board)?'blocked_after_two_adds':'cleared',adds,removals,remainingDigits:core.occupied(board)};
}

const rows=[];
for(const level of design.levels) for(let seed=design.seeds.from;seed<=design.seeds.through;seed++) {
  const {board,proof,fallback}=generator.generateClassic(generator.newClassicRun(seed),level);
  let replay=[...board];
  for(const move of proof) replay=move===null?core.addNumbers(replay):core.removePair(replay,...move);
  if(core.occupied(replay)||replay.length) throw new Error('Invalid generator witness');
  rows.push({level,seed,board,boardSha256:digest(board),openingPairs:core.pairs(board).length,fallback,
    outcomes:Object.fromEntries(design.policies.map(p=>[p,play(board,p,seed,level)]))});
}
const histogram=values=>values.reduce((result,value)=>(result[value]=(result[value]??0)+1,result),{});
const summary=Object.fromEntries(design.levels.map(level=>{
  const selected=rows.filter(r=>r.level===level);
  return [['easy18','normal28','hard27'][level],{
    boards:selected.length,
    witnessVerified:selected.length,
    fallback:selected.filter(r=>r.fallback).length,
    policies:Object.fromEntries(design.policies.map(p=>[p,{
      outcomes:histogram(selected.map(r=>r.outcomes[p].outcome)),
      clearedWithoutAdd:selected.filter(r=>r.outcomes[p].outcome==='cleared'&&r.outcomes[p].adds===0).length
    }])),
    allThreeClear:selected.filter(r=>design.policies.every(p=>r.outcomes[p].outcome==='cleared')).length,
    noneOfThreeClear:selected.filter(r=>design.policies.every(p=>r.outcomes[p].outcome!=='cleared')).length,
    mixedOutcomes:selected.filter(r=>new Set(design.policies.map(p=>r.outcomes[p].outcome)).size>1).length
  }];
}));
writeFileSync(new URL('policy-results.json',import.meta.url),JSON.stringify({design,summary,rows},null,2)+'\n');
console.log(JSON.stringify(summary,null,2));
