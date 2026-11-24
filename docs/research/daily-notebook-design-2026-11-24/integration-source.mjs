// Research only: execute pinned, hash-verified source without product writes.
import {readFileSync,writeFileSync,mkdirSync,mkdtempSync,rmSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {stripTypeScriptTypes} from 'node:module';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import path from 'node:path';

export const manifest=JSON.parse(readFileSync(new URL('./integration-source-manifest.json',import.meta.url),'utf8'));
const repo=path.resolve(process.env.SEEDS_CONTENT_REPO??process.cwd());
const snapshot=process.env.SEEDS_CONTENT_SNAPSHOT;
const temporary=mkdtempSync(path.join(tmpdir(),'seeds-content-design-'));
process.once('exit',()=>rmSync(temporary,{recursive:true,force:true}));
for(const expected of manifest.files){
 const bytes=snapshot?readFileSync(path.join(snapshot,expected.path)):
  execFileSync('git',['-C',repo,'show',manifest.ref+':'+expected.path],{maxBuffer:8*1024*1024,stdio:['ignore','pipe','pipe']});
 const blob=createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
 const sha256=createHash('sha256').update(bytes).digest('hex');
 if(blob!==expected.gitBlob||sha256!==expected.sha256)throw new Error('Source hash mismatch: '+expected.path);
 let source=bytes.toString('utf8'),filename=expected.path.replace(/^src\//,'');
 if(filename.endsWith('.ts')){
  filename=filename.replace(/\.ts$/,'.mjs');
  source=stripTypeScriptTypes(source,{mode:'transform'}).replace(/(\bfrom\s+)(["'])(\.[^"']+)\2/g,
   (match,prefix,quote,spec)=>spec.endsWith('.json')?match:prefix+quote+(spec==='./i18n'?'./i18n/index':spec)+'.mjs'+quote);
  source=source.replace('import("./notebook-extra.json")','import("./notebook-extra.json",{with:{type:"json"}})');
 }
 const target=path.join(temporary,filename);
 mkdirSync(path.dirname(target),{recursive:true});writeFileSync(target,source);
}
const load=name=>import(pathToFileURL(path.join(temporary,name+'.mjs')));
export const progress=await load('progress');
export const puzzles=await load('puzzles');
export const notebooks=await load('notebooks');
export const dailyRun=await load('daily-run');
