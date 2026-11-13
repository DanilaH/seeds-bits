import {read} from "./platform";
import {saveLab} from "./lab-storage";
import {checkPair,occupied,pairs} from "./core";
import {TRIAL_KEY,trialTasks,freshTrials,startTrial,trialPair,trialAdd,trialUndo,trialStopped,trialBonusProof,mockTrialReceipt,storeTrialEarned,grantTrialEarned,applyTrialBonus,readTrials,type Trials} from "./trials-lab";
import "./help-lab.css";
const dialog=document.createElement("dialog");dialog.id="help-lab";dialog.className="help-lab";document.body.append(dialog);
let busy=false;
export function closeHelpLab(){if(!dialog.open)return false;if(!busy)dialog.close();return true;}
dialog.addEventListener("cancel",e=>{e.preventDefault();closeHelpLab();});
const cellMarkup=(board:readonly number[])=>board.map((n,i)=>`<button type="button" data-lab-index="${i}" ${n?'':'disabled'} aria-label="${n || 'Пусто'}, клетка ${i+1}">${n||''}</button>`).join("");
export function installHelpLab(profile:string,parent:HTMLElement){
 if(profile!=="trials")return;
 const entry=document.createElement("button");entry.id="qa-lab";entry.className="secondary";entry.textContent="QA: Испытания · лаборатория";parent.append(entry);
 entry.onclick=()=>void openTrials();
}
async function openTrials(){
 let p:Trials,stored:string|null=null,selected=-1,note="";
 try{stored=await read(TRIAL_KEY);p=stored?readTrials(stored):freshTrials();}catch{dialog.innerHTML='<h2>Лабораторное сохранение защищено</h2><p>Не удалось прочитать эту версию. Данные не перезаписаны.</p><button id="lab-close">Закрыть</button>';dialog.querySelector<HTMLButtonElement>('#lab-close')!.onclick=()=>dialog.close();dialog.showModal();return;}
 async function write(q:Trials){
  if(busy)return false;busy=true;dialog.querySelectorAll<HTMLButtonElement|HTMLSelectElement>("button,select").forEach(n=>n.disabled=true);try{const raw=JSON.stringify(q);await saveLab(TRIAL_KEY,raw,stored);stored=raw;p=q;selected=-1;note="";return true;}
  catch(e){note=e instanceof Error?e.message:"Не удалось сохранить. Награда не потрачена.";return false;}finally{busy=false;render();}
 }
 async function recover(){if(p.pending)await write(grantTrialEarned(p));}
 function render(){
  const board=p.session.current.board,win=!occupied(board),available=pairs(board),proof=trialBonusProof(p),replay=p.entitlement&&board.join(",")===p.entitlement.before.join(",")&&p.session.current.additions===2;
  dialog.innerHTML=`<div class="lab-heading"><h2>Испытания</h2><button id="lab-close" aria-label="Закрыть">×</button></div><p class="lab-tag">Лаборатория QA · реклама имитируется · отдельное сохранение</p><label>Задание <select id="lab-task">${trialTasks.map(t=>`<option value="${t.id}" ${t.id===p.task?'selected':''}>${t.name}</option>`).join("")}</select></label><p>Очистите поле. Есть 2 добавления; добавлять можно, когда нет пар. Отмена и повтор бесплатны.</p><strong id="lab-budget">Добавлений: ${Math.max(0,2-p.session.current.additions)}${replay?' + оплаченный повтор':''} · бонус в запасе: ${p.bonus?1:0}</strong><div id="lab-board" class="lab-board">${cellMarkup(board)}</div><p id="lab-status" role="status">${note|| (win?'Поле очищено!':trialStopped(p)?replay?'Нет пар и добавлений. Оплаченный Add можно повторить бесплатно.':'Нет пар и добавлений. Можно отменить ход, начать заново или использовать проверенный бонус.':available.length?'Убирайте равные пары или пары с суммой 10.':'Пар нет. Можно добавить цифры.')}</p><div class="lab-actions"><button id="lab-undo" ${p.session.history.length?'':'disabled'}>Отмена</button><button id="lab-add" ${!win&&!available.length&&(p.session.current.additions<2||replay)?'':'disabled'}>Добавить${replay?' · повтор бесплатно':''}</button><button id="lab-restart">Сначала</button></div>${proof&&!p.pending&&(!p.rewardClaimed||p.bonus)?`<button id="lab-bonus" class="primary">${p.bonus?'Использовать сохранённый +1 Add':'QA: +1 Add за имитацию видео'}</button><p class="fine">После добавления проверен обычный ход. Полное решение не обещаем. Один бонус на попытку; отмена позволяет бесплатно повторить тот же Add.</p>`:''}${p.pending?'<button id="lab-recover">Повторить сохранение QA-награды</button>':''}`;
  dialog.querySelector<HTMLButtonElement>('#lab-close')!.onclick=()=>closeHelpLab();
  dialog.querySelector<HTMLSelectElement>('#lab-task')!.onchange=e=>void write(startTrial(p,(e.target as HTMLSelectElement).value));
  dialog.querySelector<HTMLButtonElement>('#lab-restart')!.onclick=()=>void write(startTrial(p,p.task));
  dialog.querySelector<HTMLButtonElement>('#lab-undo')!.onclick=()=>void write(trialUndo(p));
  dialog.querySelector<HTMLButtonElement>('#lab-add')!.onclick=()=>{try{void write(trialAdd(p,dialog.scrollTop));}catch(e){note=String(e);render();}};
  dialog.querySelector<HTMLButtonElement>('#lab-recover')?.addEventListener('click',()=>void recover());
  for(const button of dialog.querySelectorAll<HTMLButtonElement>('[data-lab-index]'))button.onclick=async()=>{
   if(busy)return;const i=Number(button.dataset.labIndex);
   if(selected<0){selected=i;button.classList.add('selected');return;}
   const a=selected;selected=-1;
   if(checkPair(board,a,i).ok)await write(trialPair(p,a,i,dialog.scrollTop));else{note="Эта пара не подходит. Выберите другую.";render();}
  };
  dialog.querySelector<HTMLButtonElement>('#lab-bonus')?.addEventListener('click',async()=>{
   if(busy||!proof)return;
   if(p.bonus){await write(applyTrialBonus(p,dialog.scrollTop));return;}
   const receipt=mockTrialReceipt(p);
   dialog.innerHTML='<h2>Имитация rewarded</h2><p>Это лабораторная QA-награда, без настоящей рекламы и дохода. Один завершённый просмотр даёт один дополнительный Add.</p><button id="lab-earn" class="primary">Засчитать QA-награду</button><button id="lab-dismiss">Закрыть без награды</button>';
   dialog.querySelector<HTMLButtonElement>('#lab-dismiss')!.onclick=()=>render();
   dialog.querySelector<HTMLButtonElement>('#lab-earn')!.onclick=async()=>{
    if(busy)return;
    if(!await write(storeTrialEarned(p,receipt)))return;
    if(!await write(grantTrialEarned(p)))return;
    if(p.attempt===receipt.attempt&&p.session.current.board.join(',')===receipt.proof.before.join(','))await write(applyTrialBonus(p,dialog.scrollTop));
   };
  });
 }
 render();dialog.showModal();await recover();
}
