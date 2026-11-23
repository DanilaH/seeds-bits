import {readFileSync,writeFileSync,mkdirSync,mkdtempSync,rmSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {stripTypeScriptTypes} from 'node:module';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import path from 'node:path';

// Research loader: read pinned Git objects and verify every executed TS/JSON.
// No import of mutable application files, no network, no product writes.
const specification=JSON.parse(readFileSync(new URL('./manifest.json',import.meta.url),'utf8'));
const checkout=path.resolve(process.env.SEEDS_AUDIT_REPO??process.cwd());
const temporary=mkdtempSync(path.join(tmpdir(),'seeds-content-audit-'));
process.once('exit',()=>rmSync(temporary,{recursive:true,force:true}));
export const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');

function prepare(name){
 const definition=specification[name],source=new Map();
 const outputRoot=path.join(temporary,name);
 for(const expected of definition.files){
  let bytes;
  try{
   bytes=execFileSync('git',['-C',checkout,'show',definition.ref+':'+expected.path],
    {maxBuffer:8*1024*1024,stdio:['ignore','pipe','pipe']});
  }catch(error){
   throw new Error('Cannot read '+specification.repository+'@'+definition.ref+':'+expected.path+
    '. Run inside a checkout containing all three pinned commits, or set SEEDS_AUDIT_REPO.',{cause:error});
  }
  const blob=createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
  const sha256=createHash('sha256').update(bytes).digest('hex');
  if(blob!==expected.gitBlob||sha256!==expected.sha256)
   throw new Error('Source hash mismatch: '+definition.ref+':'+expected.path);
  let text=bytes.toString('utf8');source.set(expected.path,text);
  let filename=expected.path.replace(/^src\//,'');
  if(filename.endsWith('.ts')){
   filename=filename.replace(/\.ts$/,'.mjs');
   text=stripTypeScriptTypes(text,{mode:'transform'}).replace(/(\bfrom\s+)(["'])(\.[^"']+)\2/g,
    (match,prefix,quote,spec)=>spec.endsWith('.json')?match:
     prefix+quote+(spec==='./i18n'?'./i18n/index':spec)+'.mjs'+quote);
   // Vite supports this JSON import; Node requires the equivalent attribute.
   text=text.replace('import("./notebook-extra.json")','import("./notebook-extra.json",{with:{type:"json"}})');
  }
  const output=path.join(outputRoot,filename);
  mkdirSync(path.dirname(output),{recursive:true});writeFileSync(output,text);
 }
 return {
  manifest:{repo:specification.repository,ref:definition.ref,files:definition.files},
  source,
  load:module=>import(pathToFileURL(path.join(outputRoot,module+'.mjs'))),
 };
}
const current=prepare('current'),previous=prepare('previous'),legacy=prepare('legacy');
export const manifest=current.manifest;
export function readSource(name){
 const text=current.source.get(name);
 if(text===undefined)throw new Error('Unlisted source: '+name);
 return text;
}
export const core=await current.load('core');
export const generator=await current.load('classic-generator');
export const profile=await current.load('classic-profile');
export const progress=await current.load('progress');
export const help=await current.load('help-contract');
export const jars=await current.load('jars');
export const puzzles=await current.load('puzzles');
export const notebooks=await current.load('notebooks');
export const dailyRun=await current.load('daily-run');
export const solver=await current.load('solver');
export const prior={
 core:await previous.load('core'),generator:await previous.load('classic-generator'),
 progress:await previous.load('progress'),help:await previous.load('help-contract'),
 jars:await previous.load('jars'),manifest:previous.manifest,
 old:{core:await legacy.load('core'),generator:await legacy.load('classic-generator'),manifest:legacy.manifest},
};
