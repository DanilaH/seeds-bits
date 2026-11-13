import {read} from "./platform";
import {saveLab} from "./lab-storage";
import {requestShuffle} from "./shuffle-lab-client";
import {SHUFFLE_KEY,freshShuffle,readShuffle,restartShuffle,shuffleIntent,applyShuffle,undoShuffle,canReplayShuffle,mockShuffleReceipt,storeShuffleEarned,grantShuffleEarned,shuffleCount,type ShuffleLab,type ShuffleIntent} from "./shuffle-lab";
const cells=(board:readonly number[])=>board.map(n=>`<span>${n||''}</span>`).join('');
export async function openShuffle(dialog:HTMLDialogElement,onBusy:(busy:boolean)=>void){
 let p:ShuffleLab,stored:string|null=null,busy=false,note='',intent:ShuffleIntent|undefined;
 try{stored=await read(SHUFFLE_KEY);p=stored?readShuffle(stored):freshShuffle();}catch{dialog.innerHTML='<h2>Лабораторное сохранение защищено</h2><p>Эта версия не прочитана; данные не перезаписаны.</p><button id="lab-close">Закрыть</button>';dialog.querySelector<HTMLButtonElement>('#lab-close')!.onclick=()=>dialog.close();dialog.showModal();return;}
 const scene=crypto.randomUUID();dialog.dataset.labScene=scene;
 function lock(value:boolean){busy=value;onBusy(value);if(value)dialog.querySelectorAll<HTMLButtonElement>('button').forEach(n=>n.disabled=true);}
 async function write(q:ShuffleLab){if(busy)return false;lock(true);try{const raw=JSON.stringify(q);await saveLab(SHUFFLE_KEY,raw,stored);stored=raw;p=q;note='';return true;}catch(e){note=e instanceof Error?e.message:'Не удалось сохранить. Заряд не потрачен.';return false;}finally{lock(false);render();}}
 function render(){
  if(dialog.dataset.labScene!==scene)return;
  dialog.innerHTML=`<div class="lab-heading"><h2>Собрать остатки</h2><button id="lab-close" aria-label="Закрыть">×</button></div><p class="lab-tag">Лаборатория QA · реклама имитируется · отдельное сохранение</p><p>Собрать имеющиеся цифры без пустот и переставить их. Цифры не удаляются и не добавляются. Проверяем обычную пару; полное решение не обещаем.</p><strong id="shuffle-count">${shuffleCount(p)} цифр · ширина 9</strong><div id="shuffle-board" class="lab-board shuffle-grid">${cells(p.session.current.board)}</div><p id="lab-status" role="status">${note || (p.entitlement ? canReplayShuffle(p)?'Ту же перестановку можно повторить бесплатно.':'Перестановка использована. Отмена вернёт прежнее поле и прокрутку.':'Откройте предпросмотр. Одно новое применение на попытку.')}</p><div class="lab-actions"><button id="shuffle-preview" ${p.entitlement&&!canReplayShuffle(p)||p.pending?'disabled':''}>${canReplayShuffle(p)?'Повторить предпросмотр':'Предпросмотр'}</button><button id="lab-undo" ${p.session.history.length?'':'disabled'}>Отмена</button><button id="lab-restart">Сначала</button></div>${p.credit?'<p>1 QA-заряд в запасе.</p>':''}${p.pending?'<button id="lab-recover">Восстановить QA-награду</button>':''}`;
  dialog.querySelector<HTMLButtonElement>('#lab-close')!.onclick=()=>dialog.close();
  dialog.querySelector<HTMLButtonElement>('#lab-undo')!.onclick=()=>void write(undoShuffle(p));
  dialog.querySelector<HTMLButtonElement>('#lab-restart')!.onclick=()=>void write(restartShuffle(p));
  dialog.querySelector<HTMLButtonElement>('#lab-recover')?.addEventListener('click',()=>void write(grantShuffleEarned(p)));
  dialog.querySelector<HTMLButtonElement>('#shuffle-preview')!.onclick=async()=>{
   if(busy)return;
   if(canReplayShuffle(p))intent=p.entitlement;
   else{lock(true);const search=requestShuffle(p.session.current.board),result=await search.result;lock(false);if(!dialog.open||dialog.dataset.labScene!==scene)return;if(result.status!=='found'||!result.proof){note=result.status==='unknown'?'Проверка не уложилась в лимит. Ничего не потрачено.':'Подходящей перестановки не найдено. Ничего не потрачено.';render();return;}intent=shuffleIntent(p,result.proof);}
   preview();
  };
 }
 function preview(){
  if(!intent)return;const i=intent,free=Boolean(p.entitlement),source=free?'Повторить бесплатно':p.credit?'Применить · 1 QA-заряд':!p.demoUsed?'Первый пример бесплатно':'QA: имитация видео · 1 перестановка';
  dialog.innerHTML=`<div class="lab-heading"><h2>Предпросмотр</h2><button id="shuffle-cancel" aria-label="Закрыть">×</button></div><p class="lab-tag">QA · ${free?'уже оплачено':p.credit?'сохранённый заряд':!p.demoUsed?'демонстрация':'имитация rewarded'}</p><div id="shuffle-comparison"><section><strong>До</strong><div class="lab-board shuffle-grid">${cells(i.proof.before)}</div></section><section><strong>После · те же ${i.proof.after.length} цифр</strong><div class="lab-board shuffle-grid">${cells(i.proof.after)}</div></section></div><p>После перестановки есть обычная пара. Пустоты исчезнут, порядок изменится. Отмена вернёт точное прежнее поле и прокрутку; этот результат можно повторить бесплатно.</p><button id="shuffle-confirm" class="primary">${source}</button><button id="shuffle-dismiss" class="secondary">Не сейчас</button>`;
  dialog.querySelector<HTMLButtonElement>('#shuffle-cancel')!.onclick=()=>{intent=undefined;render();};dialog.querySelector<HTMLButtonElement>('#shuffle-dismiss')!.onclick=()=>{intent=undefined;render();};
  dialog.querySelector<HTMLButtonElement>('#shuffle-confirm')!.onclick=async()=>{
   if(busy)return;
   const scroll=dialog.scrollTop;
   if(free||p.credit||!p.demoUsed){try{await write(applyShuffle(p,i,scroll));}catch{note='Позиция изменилась. Право сохранено.';render();}return;}
   const receipt=mockShuffleReceipt(p,i);
   dialog.innerHTML='<h2>Имитация rewarded</h2><p>Это QA-прототип без настоящей рекламы и дохода.</p><button id="lab-earn" class="primary">Засчитать QA-награду</button><button id="lab-dismiss" class="secondary">Закрыть без награды</button>';
   dialog.querySelector<HTMLButtonElement>('#lab-dismiss')!.onclick=render;
   dialog.querySelector<HTMLButtonElement>('#lab-earn')!.onclick=async()=>{if(busy)return;if(!await write(storeShuffleEarned(p,receipt)))return;if(!await write(grantShuffleEarned(p)))return;try{await write(applyShuffle(p,i,scroll));}catch{note='Позиция изменилась. QA-заряд в запасе.';render();}};
  };
 }
 render();dialog.showModal();if(p.pending)await write(grantShuffleEarned(p));
}
