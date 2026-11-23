// Replay the pinned 12082 CI evidence. Node 24+, Git; unzip only for ZIP input.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {stripTypeScriptTypes} from 'node:module';
import {pathToFileURL} from 'node:url';
import {parseArgs} from 'node:util';

const RUNTIME='eae2bcbeaaa1a5c76872dddc7a7f79844988b60e';
const BASELINE='7f8ac0e05a338d4101d10f680720343b6881ba9a';
const ZIP_SHA256='dc5fdc6306463b3246a53f6d62651c20c6a7ff480cb64edea9e52458af15d17c';
const {values:args}=parseArgs({options:{
  artifact:{type:'string'},
  checkout:{type:'string'},
  out:{type:'string'},
  help:{type:'boolean',default:false},
}});
if(args.help){
  console.log([
    'Usage:',
    '  node verify-archive.mjs --artifact <extracted-directory-or-zip> --checkout <git-repository> [--out <json-file>]',
    '',
    'Requires Node 24+, Git, and the pinned runtime commit in the repository.',
    'ZIP input additionally requires unzip. Directory input needs no ZIP utility.',
    'Reads exact Git objects using git show; verifies source and artifact hashes.',
    'Prints validation JSON. --out also writes that JSON to the specified file.',
  ].join('\n'));
  process.exit(0);
}
assert(args.artifact && args.checkout,'Pass --artifact and --checkout; use --help for usage.');
assert(Number(process.versions.node.split('.')[0])>=24,'Node 24 or newer is required.');
const hash=(b,algo='sha256')=>createHash(algo).update(b).digest('hex');
const expectedManifestBytes=fs.readFileSync(new URL('./artifact-manifest.json',import.meta.url));
const manifest=JSON.parse(expectedManifestBytes);
assert.equal(manifest.after,RUNTIME);
assert.equal(manifest.before,BASELINE);
const checkout=path.resolve(args.checkout);
const git=(...command)=>execFileSync('git',['-C',checkout,...command],{maxBuffer:4*1024*1024});
assert.equal(git('rev-parse','--verify',RUNTIME+'^{commit}').toString().trim(),RUNTIME);

const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'seeds-12082-evidence-'));
try{
  const artifact=path.resolve(args.artifact);
  let folder=artifact;
  if(!fs.statSync(artifact).isDirectory()){
    assert.equal(hash(fs.readFileSync(artifact)),ZIP_SHA256,'Unexpected artifact ZIP SHA256');
    folder=path.join(scratch,'artifact');
    fs.mkdirSync(folder);
    execFileSync('unzip',['-q',artifact,'-d',folder],{stdio:'pipe'});
  }
  assert.deepEqual(fs.readFileSync(path.join(folder,'manifest.json')),expectedManifestBytes,
    'Downloaded manifest differs from the pinned artifact manifest');
  for(const [name,sha256] of Object.entries(manifest.artifacts))
    assert.equal(hash(fs.readFileSync(path.join(folder,name))),sha256,'Artifact hash mismatch: '+name);

  const checkedSources={};
  const moduleRoot=path.join(scratch,'modules');
  fs.mkdirSync(moduleRoot);
  for(const name of ['core','classic-profile']){
    const sourcePath='src/'+name+'.ts';
    const bytes=git('show',RUNTIME+':'+sourcePath);
    const record=manifest.sources.after[sourcePath];
    assert.equal(hash(bytes),record.sha256,sourcePath);
    assert.equal(hash(Buffer.concat([Buffer.from('blob '+bytes.length+'\0'),bytes]),'sha1'),record.blob,sourcePath);
    checkedSources[sourcePath]=record;
    const module=stripTypeScriptTypes(bytes.toString(),{mode:'strip'}).replace(/(\bfrom\s+["']\.\/[^"']+)(["'])/g,'$1.mjs$2');
    fs.writeFileSync(path.join(moduleRoot,name+'.mjs'),module);
  }
  const core=await import(pathToFileURL(path.join(moduleRoot,'core.mjs')));
  const profile=await import(pathToFileURL(path.join(moduleRoot,'classic-profile.mjs')));

  // BEGIN REPLAY BODY: logic preserved from the completed independent audit.
  const rows=gunzipSync(fs.readFileSync(path.join(folder,'deals.jsonl.gz'))).toString().trimEnd().split('\n').map(JSON.parse);
  const summaries=JSON.parse(fs.readFileSync(path.join(folder,'summary.json'),'utf8'));
  let actions=0,adds=0,pairs=0;
  const results={scope:'Replaying downloaded CI deal rows through exact hashed runtime core/profile; not regenerated candidate selection',runtime:manifest.after,baseline:manifest.before,rows:rows.length,sources:checkedSources};
  for(const row of rows){
    let board=[...row.board].map(Number);
    assert.equal(board.length,[18,28,45,81][row.level]);
    assert(board.every(x=>x>=1&&x<=9));
    assert.equal(profile.classicStructure(board),row.structure);
    assert.deepEqual(profile.measureClassic(board,row.proof),row.profile);
    if(row.level===1)assert.deepEqual([...board].sort(),core.classic().sort());
    for(const move of row.proof){
      if(move===null){
        assert.equal(core.pairs(board).length,0,'Add requires no legal pairs');
        board=core.addNumbers(board);adds++;
      }else{
        assert(core.checkPair(board,...move).ok);
        const marked=board.map((v,i)=>move.includes(i)?0:v),independent=[];
        for(let i=0;i<marked.length;i+=9){const segment=marked.slice(i,i+9);if(segment.some(Boolean))independent.push(...segment);}
        board=core.removePair(board,...move);
        assert.deepEqual(board,independent);
        pairs++;
      }
      actions++;
    }
    assert.deepEqual(board,[]);
  }
  function key(row){return JSON.stringify([row.variant,row.mode,row.level,row.seriesSeed]);}
  const groups=new Map();
  for(const row of rows){const k=key(row);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(row);}
  function similarity(a,b){
   if(a.stage!==b.stage||a.structure.length!==b.structure.length)return 0;
   let filled=0,matching=0;
   for(let i=0;i<a.structure.length;i++){if(a.structure[i]==='0'&&b.structure[i]==='0')continue;filled++;if(a.structure[i]===b.structure[i])matching++;}
   return matching/(filled||1);
  }
  const counter=(obj,k)=>obj[k]=(obj[k]??0)+1;
  const fields=['opening','openingInFirstFourRows','removals','additions','firstAdd','gapMoves','readingMoves','diagonalMoves','newPairs','compressionChanges','maxDigits','peakLength'];
  function recount(group,start=0){
   const out={count:group.length-start,adjacentComparisons:0,fallback:0,requested:{},recipes:{},requestedToActual:{},motifs:{},repeats:{adjacentRecipe:0,adjacentMotif:0,adjacentCloseMotif:0,recent4Motif:0,recent4CloseMotif:0,recent8Board:0,recent8Structure:0},distributions:Object.fromEntries([...fields,'attempts','candidates','solverVisits','fallbackAttempts'].map(k=>[k,{}]))};
   for(let i=start;i<group.length;i++){
     const row=group[i],motif=row.profile.motif;out.fallback+=Number(row.fallback);
     counter(out.requested,row.requestedStyle);counter(out.recipes,row.actualRecipe);
     counter(out.requestedToActual[row.requestedStyle]??={},row.actualRecipe);
     counter(out.motifs[motif.stage]??={},motif.structure);
     for(const f of fields)counter(out.distributions[f],String(row.profile[f]));
     for(const [f,v] of Object.entries(row.diagnostics))counter(out.distributions[f],String(v));
     if(i>0){
      out.adjacentComparisons++;const prev=group[i-1];const s=similarity(motif,prev.profile.motif);
      out.repeats.adjacentRecipe+=Number(prev.actualRecipe===row.actualRecipe);
      out.repeats.adjacentMotif+=Number(s===1);out.repeats.adjacentCloseMotif+=Number(s>=.8);
     }
     const h4=group.slice(Math.max(0,i-4),i),h8=group.slice(Math.max(0,i-8),i);
     out.repeats.recent4Motif+=Number(h4.some(x=>similarity(x.profile.motif,motif)===1));
     out.repeats.recent4CloseMotif+=Number(h4.some(x=>similarity(x.profile.motif,motif)>=.8));
     out.repeats.recent8Board+=Number(h8.some(x=>x.board===row.board));
     out.repeats.recent8Structure+=Number(h8.some(x=>x.structure===row.structure));
   }
   return out;
  }
  let summariesVerified=0;
  for(const s of summaries){
   const group=groups.get(JSON.stringify([s.variant,s.mode,s.level,s.seriesSeed??null]));
   assert(group);
   if(s.mode==='series'){
    assert.deepEqual(recount(group),s.all);assert.deepEqual(recount(group,8),s.filledHistory);
    for(const row of group.filter(x=>x.index>8))assert.equal(row.recentCount,8);
   }else{
    const {variant,mode,level,size,...values}=s;assert.deepEqual(recount(group),values);
   }
   summariesVerified++;
  }
  const fresh={};
  for(const row of rows.filter(x=>x.mode==='fresh'||x.mode==='control')){
   const k=JSON.stringify([row.mode,row.level,row.seed]);
   fresh[k]??={};fresh[k][row.variant]=row;
  }
  let freshComparisons=0;
  for(const pair of Object.values(fresh)){assert.equal(pair.before.board,pair.after.board);assert.deepEqual(pair.before.proof,pair.after.proof);freshComparisons++;}
  const seriesSummary=[];
  for(const variant of ['before','after'])for(let level=0;level<4;level++){
   const ss=summaries.filter(s=>s.mode==='series'&&s.variant===variant&&s.level===level);
   const sum=(name)=>ss.reduce((a,s)=>a+s.filledHistory.repeats[name],0);
   seriesSummary.push({variant,level,count:ss.reduce((a,s)=>a+s.filledHistory.count,0),recent4Motif:sum('recent4Motif'),adjacentMotif:sum('adjacentMotif'),adjacentRecipe:sum('adjacentRecipe'),recent8Board:sum('recent8Board'),recent8Structure:sum('recent8Structure')});
  }
  Object.assign(results,{proofsPassed:rows.length,proofsFailed:0,actions,pairs,adds,summariesVerified,freshComparisonsIdentical:freshComparisons,seriesSummary,claimsNotReproduced:['No fresh generator rerun for every archived input; no verification of developer local double-run byte equality','No Android hardware / live audience / human difficulty / end-to-end timing']});
  // END REPLAY BODY.
  const output=JSON.stringify(results,null,2)+'\n';
  if(args.out)fs.writeFileSync(path.resolve(args.out),output);
  process.stdout.write(output);
}finally{
  fs.rmSync(scratch,{recursive:true,force:true});
}

