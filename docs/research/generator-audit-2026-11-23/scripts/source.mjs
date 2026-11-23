import {readFileSync,writeFileSync,mkdirSync,mkdtempSync,rmSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {stripTypeScriptTypes} from 'node:module';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import path from 'node:path';

// Research loader only. Read immutable Git objects; never import uncommitted app files.
// Run from a seeds-bits checkout containing both commits. Snapshot mode is for
// already downloaded copies, still checked against these same pinned blob hashes.
const repo='DanilaH/seeds-bits';
const currentRef='7f8ac0e05a338d4101d10f680720343b6881ba9a';
const oldRef='0c8fbba9c8864f39a398c5a6517b7b493ae3b1fc';
const currentBlobs={
 'src/core.ts':'1b4f680c74dea2fdb778bb111d18f176c791ab34',
 'src/classic-profile.ts':'27f418686fe79ed66f9045f0e3f3f8e3881499fc',
 'src/classic-dense.ts':'dbdfb1f9da795067f6c9940d748a86755070d50f',
 'src/classic-generator.ts':'e360737bdd25a1083aad31fc0c9a277c5b2cbb91',
 'src/classic-deals.ts':'568ca0a23e2176846a70f50fce83bb210844d179',
 'src/progress.ts':'af0c82991101dd793317f2569d063d401273652a',
 'src/history-codec.ts':'b84c2a230b99dc8d771e48d3a4a43f4a3fc60c6e',
 'src/hint-key.ts':'a8de88b871e8b980776cd1e97dd68d1d45bd129f',
 'src/analytics.ts':'5a928fcb3f4cb5054212b69d4d3e40d411bda263',
 'src/jars.ts':'69a560c35958265ca98389b00f0f37e8eca7e665',
 'src/calendar.ts':'b836708545670699c776d4645aeecd4ae77d5003',
 'src/daily-run.ts':'24ba676d016f80caaece0c1f988f6a82b23f2e9a',
 'src/help-contract.ts':'8e234f6a9610d0f4c2f1552f45a3f34ec94703b2',
 'src/i18n/index.ts':'ef697b8ca5f24328390218113c513acd4cec67d8',
 'src/classic-catalog.json':'008ae0def4149c479d4d2eb1947893a3c77d500b',
 'src/i18n/launch-copy.json':'81b17a6fb42eabd415ae12a611c0b341c7ef0d20',
 'src/i18n/ui-copy.json':'50910b4422ffa0bf9d30b543e16be844e8d7ce08',
};
const oldBlobs={
 'src/core.ts':'1b4f680c74dea2fdb778bb111d18f176c791ab34',
 'src/classic-generator.ts':'a1a74ff68cb625bd962a6739b6a5701ecaf01c05',
};
const checkout=path.resolve(process.env.SEEDS_AUDIT_REPO??process.cwd());
const temporary=mkdtempSync(path.join(tmpdir(),'seeds-generator-audit-'));
process.once('exit',()=>rmSync(temporary,{recursive:true,force:true}));
function prepare(ref,blobs,snapshotVariable,outputName){
 const snapshot=process.env[snapshotVariable];
 const outputRoot=path.join(temporary,outputName);
 const files=[];
 for(const [name,expected] of Object.entries(blobs)){
  let bytes;
  try{
   bytes=snapshot
    ?readFileSync(path.resolve(snapshot,name))
    :execFileSync('git',['-C',checkout,'show',ref+':'+name],{maxBuffer:8*1024*1024,stdio:['ignore','pipe','pipe']});
  }catch(error){
   throw new Error('Cannot load pinned source '+repo+'@'+ref+':'+name+
    (snapshot?' from '+path.resolve(snapshot):'. Run inside a checkout containing both audit commits, or set SEEDS_AUDIT_REPO.'),
    {cause:error});
  }
  const actual=createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
  if(actual!==expected)throw new Error('Source blob mismatch at '+ref+':'+name+'; expected '+expected+', got '+actual);
  files.push({path:name,gitBlob:actual,sha256:createHash('sha256').update(bytes).digest('hex')});
  let text=bytes.toString('utf8');
  let filename=name.replace(/^src\//,'');
  if(name.endsWith('.ts')){
   filename=filename.replace(/\.ts$/,'.mjs');
   text=stripTypeScriptTypes(text,{mode:'transform'}).replace(/(\bfrom\s+)(["'])(\.[^"']+)\2/g,(match,prefix,quote,spec)=>{
    if(spec.endsWith('.json'))return match;
    return prefix+quote+(spec==='./i18n'?'./i18n/index':spec)+'.mjs'+quote;
   });
  }
  const output=path.join(outputRoot,filename);
  mkdirSync(path.dirname(output),{recursive:true});
  writeFileSync(output,text);
 }
 return {
  manifest:{repo,ref,source:snapshot?'hash-verified snapshot':'git show',files},
  load:module=>import(pathToFileURL(path.join(outputRoot,module+'.mjs'))),
 };
}
const current=prepare(currentRef,currentBlobs,'SEEDS_AUDIT_CURRENT_SNAPSHOT','current');
const previous=prepare(oldRef,oldBlobs,'SEEDS_AUDIT_OLD_SNAPSHOT','old');
export const manifest=current.manifest;
export const core=await current.load('core');
export const profile=await current.load('classic-profile');
export const dense=await current.load('classic-dense');
export const generator=await current.load('classic-generator');
export const progress=await current.load('progress');
export const help=await current.load('help-contract');
export const jars=await current.load('jars');
export const i18n=await current.load('i18n/index');
export const old={core:await previous.load('core'),generator:await previous.load('classic-generator'),manifest:previous.manifest};
export const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');

