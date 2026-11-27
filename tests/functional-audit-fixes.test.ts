import {test, expect} from 'vitest';
import {fresh, metadata, readProgress, serializeProgress, helpProfile, ProtectedEarnedProgress, recordCompletion} from '../src/progress';
import {collectPair, jars} from '../src/jars';
import {grantReward, hintAttempt} from '../src/hint-budget';

for (const wire of [6,9,10]) test(`FA02 wire${wire}: repair stats without losing earned authority`,()=>{
 const p=fresh(),m=metadata(p);m.wallet=9;m.rewardReceipts=['earned-before-corruption'];helpProfile(p).inventory={magnet:2,plan:3};
 hintAttempt(p).hintKeys=['used'];collectPair(p,8);m.attempts.classic.completed=true;
 const raw=JSON.parse(serializeProgress(p));raw.version=wire;raw.meta.unassisted=1;const original=JSON.stringify(raw);let recovered=0;
 const q=readProgress(original,()=>recovered++);expect(recovered).toBeGreaterThan(0);
 expect(metadata(q)).toMatchObject({wallet:9,rewardReceipts:['earned-before-corruption'],attempts:m.attempts});
 expect(helpProfile(q)).toEqual(helpProfile(p));expect(jars(q)).toEqual(jars(p));expect(q.sessions).toEqual(p.sessions);
 const r=readProgress(serializeProgress(q));grantReward(r,{token:'earned-before-corruption',attempt:m.attempts.classic.id});
 expect(metadata(r).wallet).toBe(9);expect(collectPair(r,8)).toBe(0);expect(recordCompletion(r,'classic')).toEqual({seeds:0,hints:0});
});
for(const field of ['wallet','help','rewardReceipts','attempts','hintKeys','jars','daily'])test(`FA02 corrupt critical ${field} is protected, never replaced with zeros`,()=>{
 const p=fresh(),m=metadata(p);m.wallet=9;helpProfile(p).inventory={magnet:2,plan:3};m.rewardReceipts=['kept'];collectPair(p,8);
 const raw=JSON.parse(serializeProgress(p));
 if(field==='jars')raw.jars.highWater=-1;
 else if(field==='hintKeys')raw.meta.attempts.classic.hintKeys='broken';
 else raw.meta[field]='broken';
 expect(()=>readProgress(JSON.stringify(raw))).toThrow(ProtectedEarnedProgress);
});
