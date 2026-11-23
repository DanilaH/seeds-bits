import assert from 'node:assert/strict';
import {writeFileSync,mkdirSync} from 'node:fs';
import path from 'node:path';
import {core,generator,progress,help,jars,i18n,manifest,old} from './source.mjs';

const report={head:manifest.ref,old:old.manifest.ref??old.manifest.commit,evidence:'ACTUAL_SOURCE_NODE',runtime:process.version,cases:[]};
const check=(name,detail={})=>report.cases.push({name,result:'PASS',...detail});
let recoveryCount=0;
const roundtrip=p=>progress.readProgress(progress.serializeProgress(p),()=>recoveryCount++);
const apply=(game,step,scroll)=>core.commit(game,step===null?core.addNumbers(game.current.board):core.removePair(game.current.board,...step),step===null?'add':'pair',scroll);

// Generate a real legacy High-27 board with the exact previous product source.
const oldSeed=3384638011;
const legacyRun=old.generator.newClassicRun(oldSeed);
const legacyProof=old.generator.generateClassic(structuredClone(legacyRun),2);
let legacyGame=old.generator.takeGeneratedClassic(legacyRun,'legacy-high-attempt',2);
assert.equal(legacyGame.current.board.length,27);
assert.deepEqual(legacyGame.current.board,legacyProof.board);
legacyGame=apply(legacyGame,legacyProof.proof[0],19);

const p=progress.fresh();
p.sessions.classic=legacyGame;
const book=core.newSession();book.current.board=[1,9,2,8];
p.sessions['book-v1-2']=apply(book,[0,1],4);
const daily=core.newSession();daily.current.board=[3,7,4,6];
p.sessions['daily-v1-2026-11-23']=apply(daily,[0,1],6);
p.hints={'classic':2,'book-v1-2':1};
p.done=['book-v1-1','daily-v1-2026-11-22'];
p.seen=['book-v1-2','daily-v1-2026-11-23'];
const meta=progress.metadata(p);
meta.attempts.classic.id=legacyRun.current.attempt;
meta.classicRun=legacyRun;
meta.wallet=7;meta.completed=9;meta.unassisted=4;
meta.daily={lastDay:'2026-11-22',count:3,best:5,reward:1};
meta.rewardReceipts=['protected-reward-receipt'];
const profile=help.freshHelp();profile.inventory={magnet:3,plan:2};profile.demo={magnet:true,plan:true};
meta.help=profile;
const planIntent={version:1,id:'held-plan',offer:'prior-offer',product:'plan_1',task:'book-v1-2',attempt:meta.attempts['book-v1-2'].id,rules:1,algorithm:'v1',board:[1,9],pair:[0,1],proof:[[0,1]],states:[[1,9],[]]};
meta.attempts['book-v1-2'].help={version:1,assisted:true,plan:{id:'held-entitlement',intent:planIntent,applications:['prior-application'],applicationSequence:1}};
meta.help.intent=structuredClone(planIntent);
meta.help.grant={token:'already-confirmed-token',intent:'held-plan',product:'plan_1'};
Object.assign(jars.jars(p),{seeds:74,meter:74,wins:3,highWater:1});

const restored=roundtrip(p);
assert.deepEqual(restored,p);
assert.equal(recoveryCount,0);
assert.deepEqual(core.undo(restored.sessions.classic).current.board,legacyRun.current.board);
check('legacy_generated_27_move_roundtrip_and_undo',{seed:oldSeed,initial:legacyRun.current.board,occupied:core.occupied(legacyGame.current.board),scroll:19});
assert.deepEqual(restored.sessions['book-v1-2'],p.sessions['book-v1-2']);
assert.deepEqual(restored.sessions['daily-v1-2026-11-23'],p.sessions['daily-v1-2026-11-23']);
assert.deepEqual(restored.meta.help,p.meta.help);
assert.deepEqual(restored.meta.attempts['book-v1-2'].help,p.meta.attempts['book-v1-2'].help);
assert.deepEqual(restored.jars,p.jars);
check('cross_mode_wallet_daily_jar_and_paused_entitlement_roundtrip',{wallet:restored.meta.wallet,inventory:restored.meta.help.inventory,bookUndo:restored.sessions['book-v1-2'].history.length,dailyUndo:restored.sessions['daily-v1-2026-11-23'].history.length,heldPlan:true,confirmedGrant:true});

const nextRun=generator.readClassicRun(restored.meta.classicRun);
const nextHigh=generator.takeGeneratedClassic(nextRun,'new-high-attempt',2);
assert.equal(nextHigh.current.board.length,45);
assert.equal(restored.meta.classicRun.current.board.length,27);
assert.equal(restored.meta.classicRun.current.attempt,restored.meta.attempts.classic.id);
check('legacy_27_current_stays_restartable_next_high_uses_45',{nextSize:45,oldRestartInitial:27});

let oldThroughAdd=old.generator.takeGeneratedClassic(old.generator.newClassicRun(oldSeed),'legacy-add-attempt',2);
const oldAddAt=legacyProof.proof.indexOf(null);
assert.ok(oldAddAt>=0);
for(const step of legacyProof.proof.slice(0,oldAddAt))oldThroughAdd=apply(oldThroughAdd,step,31);
const preOldAdd=structuredClone(oldThroughAdd.current);
oldThroughAdd=apply(oldThroughAdd,null,31);
const oldAddProgress=structuredClone(p);
oldAddProgress.sessions.classic=oldThroughAdd;
oldAddProgress.meta.attempts.classic.id='legacy-add-attempt';
oldAddProgress.meta.classicRun.current.attempt='legacy-add-attempt';
const oldAddRestored=roundtrip(oldAddProgress);
assert.deepEqual(oldAddRestored.sessions.classic,oldThroughAdd);
assert.deepEqual(core.undo(oldAddRestored.sessions.classic).current,preOldAdd);
check('legacy_27_add_roundtrip_and_undo',{movesBeforeAdd:oldAddAt,afterAddCells:oldThroughAdd.current.board.length});

const expertSeed=73,expertRun=generator.newClassicRun(expertSeed);
const expertProof=generator.generateClassic(structuredClone(expertRun),3);
let expert=generator.takeGeneratedClassic(expertRun,'expert-attempt',3);
assert.equal(expert.current.board.length,81);
assert.deepEqual(expert.current.board,expertProof.board);
const expertAddAt=expertProof.proof.indexOf(null);
assert.ok(expertAddAt>=0);
for(const step of expertProof.proof.slice(0,expertAddAt))expert=apply(expert,step,47);
const preExpertAdd=structuredClone(expert.current);
expert=apply(expert,null,47);
const expertProgress=structuredClone(p);
expertProgress.sessions.classic=expert;
expertProgress.meta.classicRun=expertRun;
expertProgress.meta.attempts.classic.id='expert-attempt';
const expertRestored=roundtrip(expertProgress);
assert.deepEqual(expertRestored.sessions.classic,expert);
assert.deepEqual(expertRestored.meta.classicRun,expertRun);
assert.deepEqual(core.undo(expertRestored.sessions.classic).current,preExpertAdd);
check('expert_81_add_roundtrip_and_undo',{seed:expertSeed,movesBeforeAdd:expertAddAt,afterAddCells:expert.current.board.length,scroll:expertRestored.sessions.classic.current.scroll});

let mixed=generator.newClassicRun(41317);
for(let index=0;index<24;index++){
 const level=index%4;
 const independent=structuredClone(mixed);
 const liveGame=generator.takeGeneratedClassic(mixed,'mixed-'+index,level);
 const identical=generator.takeGeneratedClassic(independent,'mixed-'+index,level);
 assert.deepEqual(liveGame,identical);
 assert.deepEqual(mixed,independent);
 const state=structuredClone(p);state.sessions.classic=liveGame;state.meta.classicRun=mixed;state.meta.attempts.classic.id='mixed-'+index;
 const reload=roundtrip(state);
 assert.deepEqual(reload.sessions.classic,liveGame);
 assert.deepEqual(reload.meta.classicRun,mixed);
 mixed=reload.meta.classicRun;
 assert.ok(mixed.recent.length<=8);
 for(const history of Object.values(mixed.rotation??{}))assert.ok(history.length<=2);
}
check('four_level_mixed_sequence_serializes_seed_recent_current_rotation',{games:24,recentLength:mixed.recent.length,rotation:mixed.rotation});

const malformedRotation=structuredClone(p);
malformedRotation.meta.classicRun.rotation={0:['invented-style'],2:'invalid',3:null};
const repaired=roundtrip(malformedRotation);
assert.deepEqual(repaired.meta.classicRun,p.meta.classicRun);
assert.deepEqual(repaired.sessions,p.sessions);
check('invalid_optional_rotation_does_not_drop_legacy_current_or_undo');

for(const format of ['progress','help','entitlement']){
 const future=JSON.parse(progress.serializeProgress(p));
 if(format==='progress')future.version=7;
 if(format==='help')future.meta.help.version=2;
 if(format==='entitlement')future.meta.attempts['book-v1-2'].help.version=2;
 assert.throws(()=>progress.readProgress(JSON.stringify(future)),progress.FutureProgress);
}
check('future_progress_help_and_entitlement_data_remain_protected',{formats:3});

globalThis.document={documentElement:{lang:''}};
const translations={};
for(const locale of i18n.languages){
 i18n.useLanguage(locale);
 const label=i18n.localName(generator.classicDifficultyNames[3]);
 const detail=i18n.t('calm.classic.expertDetail');
 assert.notEqual(label,'ui.expert');
 assert.notEqual(detail,'calm.classic.expertDetail');
 assert.match(detail,/81/);
 translations[locale]={label,detail};
}
check('expert_name_and_size_description_in_all_launch_locales',{translations});
assert.equal(recoveryCount,0);
report.result='PASS';report.caseCount=report.cases.length;report.recoveries=recoveryCount;
const output=path.resolve(process.env.SEEDS_AUDIT_OUTPUT??'test-results/seeds-generator-audit');
mkdirSync(output,{recursive:true});
writeFileSync(path.join(output,'roundtrip-results.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
