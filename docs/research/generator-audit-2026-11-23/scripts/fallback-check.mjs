// Force each of the nine spare rotations with 0..8 exact prior boards.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import path from 'node:path';
import {core,generator,manifest,digest} from './source.mjs';

const results=[];
for(let level=0;level<4;level++){
  const recent=[],runs=[];
  for(let length=0;length<=8;length++){
    const state=generator.newClassicRun(12081);
    state.recent=[...recent];
    const selected=generator.generateClassic(state,level,{attempts:0});
    assert.equal(selected.fallback,true);
    assert.equal(selected.board.length,generator.CLASSIC_SIZES[level]);
    assert.equal(core.occupied(selected.board),selected.board.length);
    assert.ok(!recent.includes(selected.board.join('')));
    let board=selected.board;
    for(const step of selected.proof){
      board=step===null?core.addNumbers(board):core.removePair(board,...step);
    }
    assert.deepEqual(board,[]);
    runs.push({recent:length,attempts:selected.diagnostics.fallbackAttempts,boardSha256:digest(selected.board)});
    recent.push(selected.board.join(''));
  }
  results.push({level,runs});
}
const result={source:manifest.ref,results};
const recorded=JSON.parse(readFileSync(new URL('../data/generator-fallback-check.json',import.meta.url),'utf8'));
assert.deepEqual(result,recorded);
const output=path.resolve(process.env.SEEDS_AUDIT_OUTPUT??'test-results/seeds-generator-audit');
mkdirSync(output,{recursive:true});
writeFileSync(path.join(output,'generator-fallback-check.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({source:manifest.ref,verified:36,recordedResult:'MATCH'}));
