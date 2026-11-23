import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {stripTypeScriptTypes} from 'node:module';
import path from 'node:path';
export const sourceManifest=JSON.parse(readFileSync(new URL('./SOURCES.json',import.meta.url)));
const repo=path.resolve(process.env.SEEDS_NOTEBOOK_REPO??process.cwd());
const snapshot=process.env.SEEDS_NOTEBOOK_SNAPSHOT;
export const hash=x=>createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex');
const sources=new Map();
for(const file of sourceManifest.files){
 const bytes=snapshot?readFileSync(path.join(snapshot,file.path)):
  execFileSync('git',['-C',repo,'show',sourceManifest.ref+':'+file.path],{maxBuffer:8*1024*1024});
 const blob=createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
 if(blob!==file.gitBlob||hash(bytes.toString())!==file.sha256)throw new Error('Source hash mismatch: '+file.path);
 sources.set(file.path,bytes.toString());
}
const data=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const coreURL=data(stripTypeScriptTypes(sources.get('src/core.ts')));
export const core=await import(coreURL);
export const solver=await import(data(stripTypeScriptTypes(sources.get('src/solver.ts')).replaceAll('"./core"',JSON.stringify(coreURL))));
const first=JSON.parse(sources.get('src/notebook.json'));
const extra=JSON.parse(sources.get('src/notebook-extra.json'));
// Exact data-format decoding from pinned puzzles.ts:99–123. No new generation.
export const catalogue=[...first,...extra.map(([board,encoded],index)=>({
 id:'book-v1-'+(index+25),board:[...board].map(Number),
 solution:Array.from({length:encoded.length/3},(_,i)=>({a:encoded[i*3],b:encoded[i*3+1],kind:encoded[i*3+2]?'reading':'straight'})),
}))];
if(catalogue.length!==2400)throw new Error('Unexpected notebook catalogue');
