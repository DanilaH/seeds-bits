import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
const base='test-results/menu-reward-audio',out='test-results/visual48-comparisons';
fs.mkdirSync(out,{recursive:true});
const records=['before','baseline','after'].map(side=>JSON.parse(fs.readFileSync(path.join(base,side,'recording.json'),'utf8')));
assert.equal(records[0].source,'125606e4a90e06b844fe6eb8f83249032cb7057f');
assert.equal(records[1].source,'0f7c6a60a672e12c5b346fdd3175692fa8fb2c4c');
assert.equal(records[2].source,process.env.GITHUB_SHA);
const run=args=>{const r=spawnSync('ffmpeg',['-v','error','-y',...args],{stdio:'inherit'});assert.equal(r.status,0,'Actual-frame comparison encoding');};
const clips=[];
for(const {name} of records[2].clips){
  const inputs=['before','baseline','after'].flatMap(side=>['-i',path.join(base,side,name+'.mp4')]);
  const file=path.resolve(out,name+'.mp4');
  run([...inputs,'-filter_complex','[0:v][1:v][2:v]hstack=inputs=3[v]','-map','[v]','-map','2:a:0','-c:v','libx264','-preset','fast','-crf','21','-pix_fmt','yuv420p','-c:a','aac','-b:a','128k','-movflags','+faststart',file]);
  clips.push({name,file,seconds:6});
}
const concat=path.resolve(out,'montage.ffconcat');fs.writeFileSync(concat,'ffconcat version 1.0\n'+clips.map(c=>`file '${c.file}'`).join('\n')+'\n');
run(['-f','concat','-safe','0','-i',concat,'-c','copy','-movflags','+faststart',path.join(out,'seeds-12106-12109-12110-comparison.mp4')]);
fs.writeFileSync(path.join(out,'provenance.json'),JSON.stringify({source:process.env.GITHUB_SHA,references:records.map(r=>({side:r.side,source:r.source})),speed:1,audio:'Candidate application WebAudio mix in three-panel comparisons; each individual recording retains its own original application audio',physicalPhone:false,clips},null,2));
