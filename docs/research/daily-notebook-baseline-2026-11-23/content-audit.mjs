import assert from 'node:assert/strict';
import {writeFileSync,mkdirSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
import path from 'node:path';
import {core,generator,profile,progress,help,jars,puzzles,notebooks,dailyRun,solver,manifest,digest,readSource,prior} from './source.mjs';
const median=values=>{const a=[...values].sort((a,b)=>a-b),i=(a.length-1)/2;return(a[Math.floor(i)]+a[Math.ceil(i)])/2;};
const hist=values=>values.reduce((out,value)=>(out[value]=(out[value]??0)+1,out),{});
const output=path.resolve(process.env.SEEDS_AUDIT_OUTPUT??'test-results/daily-notebook-baseline');
mkdirSync(output,{recursive:true});
const out=(name,value)=>writeFileSync(path.join(output,name),name.endsWith('.gz')?gzipSync(JSON.stringify(value)+'\n',{level:9}):JSON.stringify(value,null,2)+'\n');
const replay=p=>{let board=p.board;for(const pair of p.solution)board=core.removePair(board,pair.a,pair.b);assert.deepEqual(board,[]);return p.solution.length;};
const firstPolicy=initial=>{let board=initial;for(let moves=0;moves<=initial.length/2;moves++){if(!core.occupied(board))return true;const pair=core.pairs(board)[0];if(!pair)return false;board=core.removePair(board,pair.a,pair.b);}return false;};
const summary={source:manifest.ref,level:'ACTUAL_SOURCE_NODE_AND_PRECOMPUTED_DATA',runtime:process.version};

await puzzles.loadNotebook();
const books=puzzles.notebook.map((p,index)=>({id:p.id,volume:Math.floor(index/24)+1,logicalCells:p.board.length,occupied:core.occupied(p.board),witnessPairs:p.solution.length,seeds:jars.taskSeeds(core.occupied(p.board)/2),boardSha256:digest(p.board),structure:profile.classicStructure(p.board)}));
assert.equal(books.length,2400);assert.equal(new Set(books.map(p=>p.id)).size,2400);
const volumeStats=Array.from({length:100},(_,i)=>{const tasks=books.filter(b=>b.volume===i+1);return {volume:i+1,minOccupied:Math.min(...tasks.map(p=>p.occupied)),medianOccupied:median(tasks.map(p=>p.occupied)),maxOccupied:Math.max(...tasks.map(p=>p.occupied)),medianLogical:median(tasks.map(p=>p.logicalCells)),medianWitnessPairs:median(tasks.map(p=>p.witnessPairs)),medianSeeds:median(tasks.map(p=>p.seeds))};});
const extra=JSON.parse(readSource('src/notebook-extra.json'));
summary.notebooks={count:books.length,volumes:notebooks.VOLUMES,volumeSize:notebooks.VOLUME_SIZE,firstId:books[0].id,lastId:books.at(-1).id,minOccupied:Math.min(...books.map(b=>b.occupied)),maxOccupied:Math.max(...books.map(b=>b.occupied)),maxLogical:Math.max(...books.map(b=>b.logicalCells)),uniqueExact:new Set(books.map(b=>b.boardSha256)).size,uniqueValueRoleStructures:new Set(books.map(b=>b.structure)).size,over54:books.filter(b=>b.occupied>54).length,rewardCap24:books.filter(b=>b.seeds===24).length,extraUtf8Bytes:Buffer.byteLength(readSource('src/notebook-extra.json')),extraWitnessJsonBytes:extra.reduce((n,row)=>n+Buffer.byteLength(JSON.stringify(row[1])),0),selectedVolumes:volumeStats.filter(v=>[1,20,40,60,80,100].includes(v.volume)),allVolumes:volumeStats};
const sampleNumbers=[1,24,78,240,480,960,1440,1920,2380,2400];
summary.notebooks.sampleWitnessReplay=sampleNumbers.map(number=>{const p=puzzles.notebook[number-1];return {id:p.id,occupied:core.occupied(p.board),logicalCells:p.board.length,pairs:replay(p),result:'PASS'};});
const book78=puzzles.notebook[77];
summary.notebooks.book78FirstChoices=core.pairs(book78.board).map(pair=>({a:pair.a,b:pair.b,result:solver.createSolver(50000)(core.removePair(book78.board,pair.a,pair.b)).kind}));

const days=Array.from({length:12},(_,i)=>puzzles.days('2026-'+String(i+1).padStart(2,'0'))).flat();
const daily=days.map(day=>{const p=puzzles.daily(day);replay(p);return {day,id:p.id,occupied:core.occupied(p.board),logicalCells:p.board.length,openingPairs:core.pairs(p.board).length,witnessPairs:p.solution.length,readingInWitness:p.solution.some(pair=>pair.kind==='reading'),firstNoAddClears:firstPolicy(p.board),seeds:jars.taskSeeds(core.occupied(p.board)/2),boardSha256:digest(p.board),structure:profile.classicStructure(p.board)};});
const jumps=daily.slice(1).map((row,i)=>({from:daily[i].day,to:row.day,jump:Math.abs(row.occupied-daily[i].occupied)}));
summary.daily2026={dates:daily.length,uniqueExact:new Set(daily.map(p=>p.boardSha256)).size,uniqueValueRoleStructures:new Set(daily.map(p=>p.structure)).size,minOccupied:Math.min(...daily.map(p=>p.occupied)),maxOccupied:Math.max(...daily.map(p=>p.occupied)),medianOccupied:median(daily.map(p=>p.occupied)),medianOpeningPairs:median(daily.map(p=>p.openingPairs)),occupiedCounts:hist(daily.map(p=>p.occupied)),logicalCellCounts:hist(daily.map(p=>p.logicalCells)),firstNoAddClears:daily.filter(p=>p.firstNoAddClears).length,readingInWitness:daily.filter(p=>p.readingInWitness).length,neighborJumpsAtLeast8:jumps.filter(p=>p.jump>=8).length,neighborJumpsAtLeast12:jumps.filter(p=>p.jump>=12).length,seedRewards:hist(daily.map(p=>p.seeds)),witnessReplays:daily.length,selectedWeek:daily.filter(p=>p.day>='2026-11-23'&&p.day<='2026-11-29')};
assert.equal(puzzles.availableDay('2025-01-01','2026-11-23'),true);
assert.equal(puzzles.availableDay('2024-12-31','2026-11-23'),false);
assert.equal(puzzles.availableDay('2026-11-24','2026-11-23'),false);
assert.equal(puzzles.availableDay('2026-02-29','2026-11-23'),false);

const rewards=progress.fresh(),task=puzzles.notebook[0];
rewards.sessions[task.id]=puzzles.puzzleSession(task);progress.startAttempt(rewards,task.id);
for(const pair of task.solution)rewards.sessions[task.id]=core.commit(rewards.sessions[task.id],core.removePair(rewards.sessions[task.id].current.board,pair.a,pair.b),'pair',0);
const firstReward=progress.recordCompletion(rewards,task.id,'2026-11-23');
assert.equal(firstReward.seeds,jars.taskSeeds(core.occupied(task.board)/2));
assert.deepEqual(progress.recordCompletion(rewards,task.id,'2026-11-23'),{seeds:0,hints:0});
progress.startAttempt(rewards,task.id);
assert.deepEqual(progress.recordCompletion(rewards,task.id,'2026-11-23'),{seeds:0,hints:0});
const streak=progress.fresh(),streakResults=[];
for(let day=1;day<=7;day++){const date='2026-11-'+String(day).padStart(2,'0');streakResults.push(dailyRun.recordDaily(streak,'daily-v1-'+date,date));}
assert.deepEqual(streakResults,[0,0,1,0,0,0,3]);
assert.equal(dailyRun.recordDaily(streak,'daily-v1-2026-11-06','2026-11-08'),0);
assert.equal(dailyRun.recordDaily(streak,'daily-v1-2026-11-07','2026-11-07'),0);
assert.equal(puzzles.trophy('2026-11',puzzles.days('2026-11').slice(0,7).map(day=>'daily-v1-'+day)).tier,1);
summary.rewardAndDateContracts={firstUniqueBookSeeds:firstReward.seeds,repeatAttemptSeeds:0,sevenTodayStreakHints:streakResults,archiveDoesNotAdvanceStreak:true,duplicateDayReward:0,bronzeAt7:true,archiveStart:'2025-01-01',futureAndInvalidDatesBlocked:true};

// The loader provides hash-verified pinned sources to construct genuine prior saves.
const migrations=[];
for(const [name,oldGenerator,level,seed] of [['12081-high45',prior.generator,2,15],['legacy-high27',prior.old.generator,2,3384638011]]){
 const run=oldGenerator.newClassicRun(seed);let game=oldGenerator.takeGeneratedClassic(run,name,level);
 const initial=structuredClone(game.current.board),pair=core.pairs(initial)[0];
 game=core.commit(game,core.removePair(initial,pair.a,pair.b),'pair',19);
 const saved=prior.progress.fresh();saved.sessions.classic=game;
 const m=prior.progress.metadata(saved);m.attempts.classic.id=name;m.classicRun=run;m.wallet=7;
 m.help=prior.help.freshHelp();m.help.inventory={magnet:3,plan:2};
 saved.sessions['book-v1-78']=puzzles.puzzleSession(book78);
 saved.sessions['daily-v1-2026-11-23']=puzzles.puzzleSession(puzzles.daily('2026-11-23'));
 saved.done=['book-v1-1'];saved.hints={'book-v1-78':1};
 Object.assign(prior.jars.jars(saved),{seeds:74,meter:74,wins:3});
 let recoveries=0;const restored=progress.readProgress(prior.progress.serializeProgress(saved),()=>recoveries++);
 const expected=structuredClone(saved);delete expected.meta.classicRun.rotation;
 assert.deepEqual(restored,expected);assert.equal(recoveries,0);
 assert.deepEqual(core.undo(restored.sessions.classic).current.board,initial);
 assert.equal(restored.meta.classicRun.scenarios,undefined);
 const newRun=generator.readClassicRun(restored.meta.classicRun);generator.takeGeneratedClassic(newRun,name+'-next',2);
 assert.equal(newRun.current.board.length,45);assert.equal(newRun.scenarios[2].length,1);
 migrations.push({name,oldSource:name==='legacy-high27'?prior.old.manifest.ref:prior.manifest.ref,initialSize:initial.length,oldRotation:run.rotation??null,newScenariosBeforeNext:null,newScenariosAfterNext:1,oldUndo:'PASS',sessionsWalletHelpPreserved:true,recoveries});
}
let state=generator.newClassicRun(12082);
for(let n=0;n<8;n++){
 const before=generator.readClassicRun(state),probe=generator.generateClassic(structuredClone(before),2);
 const game=generator.takeGeneratedClassic(state,'scenario-'+n,2);
 assert.deepEqual(game.current.board,probe.board);
 assert.deepEqual(state.scenarios[2].at(-1),{recipe:probe.recipe,motif:probe.profile.motif});
 const p=progress.fresh();p.sessions.classic=game;const m=progress.metadata(p);m.classicRun=state;m.attempts.classic.id='scenario-'+n;
 state=progress.readProgress(progress.serializeProgress(p)).meta.classicRun;
 assert.ok(state.scenarios[2].length<=4);
}
const good=structuredClone(state),corrupt=structuredClone(state);
corrupt.scenarios={2:[...good.scenarios[2].slice(-2),{recipe:'missing',motif:{stage:'first-add',structure:'1'}},null],3:'invalid'};
const repaired=generator.readClassicRun(corrupt);
assert.deepEqual(repaired.current,good.current);assert.deepEqual(repaired.recent,good.recent);assert.equal(repaired.seed,good.seed);
assert.deepEqual(repaired.scenarios[2],good.scenarios[2].slice(-2));
assert.equal(repaired.scenarios[3],undefined);
summary.metadataMigration={previous:prior.manifest.ref,current:manifest.ref,migrations,newHistoryGames:8,maxScenarios:4,recordsActualRecipeAndMotif:true,corruptOptionalMetadataKeepsCurrentRecentSeed:true,result:'PASS'};
summary.method={"notebooks":"All 2400 fixed boards were counted; only 10 selected stored witnesses replayed in this audit, not all 2400.","daily2026":"Actual-source deterministic calendar sweep of 365 dates, 2026-01-01 through 2026-12-31; not player sessions. Dates after 2026-11-23 are prospective.","medians":"For an even sample, arithmetic mean of the two central sorted values. Earlier issue14 notebook values use the lower central value.","walletUnit":"meta.wallet stores shared additional hint credits, separate from seeds/jars and the up-to-three free hints in an attempt.","deviceAndLive":"Physical phone timing/feel, user retention and seeds per minute were not measured."};
out('results.json',summary);
out('rows.json.gz',{source:manifest.ref,notebooks:books,daily2026:daily,adjacentDateJumps:jumps});
console.log(JSON.stringify({...summary,notebooks:{...summary.notebooks,allVolumes:undefined}},null,2));
