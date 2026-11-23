import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {stripTypeScriptTypes} from 'node:module';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
export const manifest=JSON.parse(readFileSync(new URL('./source-manifest.json',import.meta.url)));
export const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const temporary=mkdtempSync(path.join(tmpdir(),'seeds-daily-design-'));
process.once('exit',()=>rmSync(temporary,{recursive:true,force:true}));
const repo=process.env.SEEDS_RESEARCH_REPO??process.cwd();
for(const expected of manifest.files){
 const bytes=process.env.SEEDS_DAILY_SNAPSHOT
  ?readFileSync(path.join(process.env.SEEDS_DAILY_SNAPSHOT,expected.path))
  :execFileSync('git',['-C',repo,'show',manifest.ref+':'+expected.path],{maxBuffer:4*1024*1024});
 const sha=createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
 if(sha!==expected.gitBlob||createHash('sha256').update(bytes).digest('hex')!==expected.sha256)
  throw new Error('Source hash mismatch: '+expected.path);
 let filename=path.basename(expected.path),text=bytes.toString();
 if(filename.endsWith('.ts')){
  filename=filename.replace(/\.ts$/,'.mjs');
  text=stripTypeScriptTypes(text,{mode:'transform'}).replace(/(\bfrom\s+)(["'])(\.[^"']+)\2/g,
   (match,prefix,quote,spec)=>spec.endsWith('.json')?match:prefix+quote+spec+'.mjs'+quote);
 }
 writeFileSync(path.join(temporary,filename),text);
}
const load=name=>import(pathToFileURL(path.join(temporary,name+'.mjs')));
export const core=await load('core');
export const profile=await load('classic-profile');
export const puzzles=await load('puzzles');
export const solver=await load('solver');
