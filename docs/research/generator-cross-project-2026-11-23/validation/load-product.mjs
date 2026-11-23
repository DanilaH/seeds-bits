import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {stripTypeScriptTypes} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.dirname(fileURLToPath(import.meta.url));
// Source files are immutable audit inputs; no production files are written.
const sourceRoot=process.env.SEEDS_AUDIT_SOURCE_ROOT ?? (existsSync(path.join(root,'snapshot')) ? path.join(root,'snapshot') : path.resolve(root,'../../../..'));
export const manifest=JSON.parse(readFileSync(path.join(root,'snapshot-manifest.json'),'utf8'));
export function readSource(name){
 const bytes=readFileSync(path.join(sourceRoot,name));
 const expected=manifest.files.find(f=>f.path===name);
 const actual=createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
 if(!expected||actual!==expected.gitBlob)throw new Error('Source mismatch at pinned '+manifest.ref+': '+name+'; use SEEDS_AUDIT_SOURCE_ROOT to select the exact checkout');
 return bytes.toString('utf8');
}
const dataURL=source=>'data:text/javascript;base64,'+Buffer.from(source).toString('base64');
const coreURL=dataURL(stripTypeScriptTypes(readSource('src/core.ts')));
export const core=await import(coreURL);
const generatorTS=readSource('src/classic-generator.ts');
if(generatorTS.split('"./core"').length!==2)throw new Error('Unexpected core import');
const generatorJS=stripTypeScriptTypes(generatorTS).replace('"./core"',JSON.stringify(coreURL));
export const generator=await import(dataURL(generatorJS));
export const catalog=JSON.parse(readSource('src/classic-catalog.json'));
export const catalogProofs=JSON.parse(readSource('scripts/classic-variety/proofs.json'));
export const recordedMetrics=JSON.parse(readSource('docs/classic-variety-2026-11-12/content.json'));
export const digest=board=>createHash('sha256').update(JSON.stringify(board)).digest('hex');
