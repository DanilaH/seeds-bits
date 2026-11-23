import {readFileSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {gunzipSync} from 'node:zlib';
import {catalogue,core,sourceManifest,hash} from './source.mjs';
const output=path.resolve(process.env.SEEDS_NOTEBOOK_OUTPUT??'test-results/notebook-content-design');
const profiles=JSON.parse(gunzipSync(readFileSync(path.join(output,'profiles-full.json.gz'))));
const page=(title,goal,ids)=>({title,goal,ids});
const proposed=[
 {id:'seeds-notebook-links-pilot-20261124',title:'Новые связи',pages:[
  page('Освободи линию','Снятие открывает новые пары; несколько направлений и короткая передышка.',[6,8,89,137,184,84]),
  page('За край строки','Узнать и применить связь по порядку чтения в разных конфигурациях.',[105,133,111,180,214,241]),
  page('Смена приёма','Чередовать раскрытие и чтение края без монотонного роста размера.',[46,212,256,119,235,173]),
  page('Связи вместе','Соединить знакомые эпизоды; последние поля компактны, но богаче связями.',[52,63,100,148,103,45]),
 ]},
 {id:'seeds-notebook-order-pilot-20261124',title:'Поле меняется',pages:[
  page('Строка исчезает','Заметить, какие новые связи создаёт реальное сжатие строки.',[216,206,42,64,115,175]),
  page('Новая геометрия','Разные места сжатия и последствия в более насыщенных коротких полях.',[318,134,202,310,260,107]),
  page('Порядок имеет значение','Сопоставить варианты и использовать Undo; финальная пара70/73 контролирует объём и число стартовых пар.',[33,78,181,189,70,73]),
  page('Комбинации','Пары приёмов, короткий контраст и 1–2 финальных сочетания раскрытия, края и сжатия; не все три в каждой задаче.',[102,161,322,317,164,171]),
 ]},
];
const seen=new Set();
for(const collection of proposed){
 let position=0;
 collection.pages=collection.pages.map((p,pageIndex)=>({title:p.title,goal:p.goal,tasks:p.ids.map(number=>{
  const task=catalogue[number-1],profile=profiles.find(x=>x.id===task.id);assert(profile);assert(!seen.has(task.id));seen.add(task.id);
  assert(profile.occupied<=32&&profile.logical<=54);
  return {position:++position,page:pageIndex+1,taskId:task.id,sourceOrdinal:number,boardSha256:hash(task.board.join('')),
   occupied:profile.occupied,logicalCells:profile.logical,witnessMoves:profile.moves,
   observedEpisodes:{openTwoOrMore:profile.openingEpisodes,compressionNewPair:profile.compressionEpisodes,readingBeforeLastQuarter:profile.earlyReading},
   policyDiagnostics:{firstClears:profile.firstPolicy.cleared,lastClears:profile.lastPolicy.cleared}};
 })}));
 assert.equal(position,24);
}
writeFileSync(path.join(output,'pilot-reference-sets.json'),JSON.stringify({source:sourceManifest.ref,status:'RESEARCH_REFERENCE_SELECTION_NOT_NEW_PRODUCT_CONTENT',
 meaning:'48 existing immutable tasks demonstrate two 24-slot thematic notebooks. These are reference/QA selections, not48 new task IDs or new rewards. Theme tags describe verified certificates, not mandatory paths for every player.',
 implementationOptions:{recommended:'Use these references to author the first two new short thematic notebooks, with independent content IDs and fixed published boards. A separate compatibility design must preserve all old IDs.',lowCostQA:'A QA-only collection may link these existing IDs; solved state and one-time task reward remain shared with the legacy catalogue.'},
 caps:{occupied:32,logicalCells:54,pagesPerBook:4,tasksPerPage:6},
 uniqueExistingTasks:seen.size,collections:proposed},null,2)+'\n');
console.log(JSON.stringify({referenceTasks:seen.size,collections:proposed.map(x=>({id:x.id,tasks:x.pages.reduce((s,p)=>s+p.tasks.length,0)}))},null,2));
