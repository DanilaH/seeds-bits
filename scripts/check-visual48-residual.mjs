import fs from 'node:fs';
import assert from 'node:assert/strict';
const root='test-results',baseline='6daea5abd6609008e2338476d81e24171714c50a';
const before=JSON.parse(fs.readFileSync(`${root}/visual48-before/metrics.json`)),after=JSON.parse(fs.readFileSync(`${root}/visual48-after/metrics.json`));
assert.equal(before.source,baseline);assert.equal(after.source,process.env.GITHUB_SHA);
assert.deepEqual(before.errors,[]);assert.deepEqual(after.errors,[]);
const navigation=['progress-open','learn','settings-open','pause-language'];
const home=data=>data.frames.filter(f=>/^320x520-(light|dark)-(ru|en|es|tr|pt-BR)-home$/.test(f.name)).map(f=>({name:f.name,controls:f.controls.filter(c=>navigation.includes(c.id))}));
const homeBefore=home(before),homeAfter=home(after);
for(const frames of [homeBefore,homeAfter]){assert.equal(frames.length,10);for(const f of frames)assert.equal(f.controls.length,4);}
const whole=frames=>frames.every(f=>f.controls.every(c=>c.whole&&c.hits.length===5&&c.hits.every(Boolean)));
assert(!whole(homeBefore),'Immutable12110 must reproduce compact Home defect');
assert(whole(homeAfter),'All10 initial Home frames must contain four whole raw hit targets');
const targets=[['568x320-light-ru-home','book-quick'],['844x390-dark-pt-BR-classic-field','undo']];
const glyphs=targets.map(([name,id])=>{
 const a=before.frames.find(f=>f.name===name),b=after.frames.find(f=>f.name===name);assert(a&&b,name);
 const old=a.textClips.filter(t=>t.id===id),current=b.textClips.filter(t=>t.id===id);
 assert(old.length>0,`Immutable12110 must reproduce ${id} own-bound glyph overflow`);
 assert.equal(current.length,0,`${id} glyphs must fit their own control`);
 const button=b.controls.find(c=>c.id===id);assert(button?.whole,`${id} whole target`);
 if(!button.disabled)assert(button.hits.length===5&&button.hits.every(Boolean),`${id} raw hit points`);
 return {name,id,before:old,after:current,control:button};
});
fs.writeFileSync(`${root}/visual48-residual-comparison.json`,JSON.stringify({source:after.source,baseline,status:'PASS',scope:'Known residuals are asserted separately from read-only metrics acquisition. Actual far-hint contrast/focus/pressed/jump is gated by visual48-residual.spec.ts.',homeBefore,homeAfter,glyphs},null,2));
console.log('VA02R10/10 Home; VA04R book/Undo own glyph bounds PASS; immutable12110 defects reproduced');
