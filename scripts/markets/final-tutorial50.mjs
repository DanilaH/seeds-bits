import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';

// Actual native persistence, ADB touches and process death; never bundled.
export async function verifyFinalTutorial50({adb,profiles,fixture,launchOpeningInputCase,launch,stop,connect,progress,settings,out}) {
 const original=profiles().values,report={source:process.env.GITHUB_SHA,status:'RUNNING',physicalPhone:false,cases:[]};
 const checkpoint=()=>fs.writeFileSync(out+'/final-tutorial50.json',JSON.stringify(report,null,2));
 const shot=name=>fs.writeFileSync(out+'/'+name+'.png',execFileSync('adb',['exec-out','screencap','-p']));
 const shape=data=>({active:data.active,sessions:Object.fromEntries(Object.entries(data.sessions).map(([id,s])=>[id,{...s,current:{...s.current,scroll:0}}])),done:data.done,hints:data.hints,jars:data.jars,wallet:data.meta?.wallet??0});
 const geometry=`(()=>{const r=s=>document.querySelector(s).getBoundingClientRect().toJSON();return {viewport:r('#viewport'),footer:r('footer'),status:r('.status-wrap'),width:innerWidth,height:innerHeight};})()`;
 try{
  adb('shell','wm','size','640x1232');
  for(const theme of ['light','dark']){
   stop();launchOpeningInputCase();let ui=await connect();
   try{
    await ui.until("!!document.querySelector('.opening-copy') && !document.querySelector('#dialog').open");
    await ui.tap('#menu');await ui.tap('#settings-open');if(await ui.evaluate("document.querySelector('#dark').checked")!==(theme==='dark'))await ui.tap('#dark');await ui.tap('#settings-back');await ui.tap('#resume');
    assert.deepEqual(profiles().values[progress].sessions['book-v1-1'].current.board,[0,0,0,0,9,1,0,1,6,3,0,3,0,0,9,0,0,4]);
    shot('tutorial50-'+theme+'-first');
    await ui.tap('#board [data-index="8"]');await ui.tap('#board [data-index="17"]');
    await ui.until("document.querySelector('.game').dataset.persistence==='saved' && document.querySelector('#remaining').textContent==='6'");
    // No post-ACK sleep or disk polling before real process death.
    stop();ui.close();ui=undefined;
    assert.equal(profiles().values[progress].sessions['book-v1-1'].current.moves,1);
    launch();ui=await connect();await ui.tap('#resume');await ui.until("!!document.querySelector('.opening-copy') && document.querySelector('#remaining').textContent==='6'");
    const before=shape(profiles().values[progress]);await ui.tap('#menu');await ui.tap('#learn');
    const lessons=[];
    for(let step=0;step<6;step++){
     await ui.until(`document.querySelector('#lesson-step').textContent==='${step+1} / 6'`);
     const start=await ui.evaluate(geometry);shot('tutorial50-'+theme+'-lesson-'+(step+1));
     if(step===5){await ui.tap('#add');await ui.until("document.querySelector('#remaining').textContent==='4'");await ui.tap('#undo');}
     else{const [a,b]=[[0,1],[0,1],[0,3],[0,20],[8,9]][step];await ui.tap(`#board [data-index="${a}"]`);await ui.tap(`#board [data-index="${b}"]`);}
     await ui.until("!document.querySelector('#lesson-next').hidden");const answered=await ui.evaluate(geometry);
     for(const key of ['viewport','footer'])for(const value of ['x','y','width','height'])assert(Math.abs(start[key][value]-answered[key][value])<=1,`${theme}/${step+1}/${key}/${value}`);
     lessons.push({step:step+1,start,answered});await ui.tap('#lesson-next');
    }
    await ui.until("document.querySelector('#lesson').hidden");
    if(!await ui.evaluate("document.querySelector('#dialog').open"))await ui.tap('#menu');
    assert.deepEqual(shape(profiles().values[progress]),before,'Practice cannot mutate the real task/history/resources');
    await ui.tap('#learn');await ui.tap('#skip');await ui.until("document.querySelector('#lesson').hidden");
    if(await ui.evaluate("document.querySelector('#dialog').open"))await ui.tap('#resume');
    for(const [a,b] of [[4,5],[9,11],[7,14]]){await ui.tap(`#board [data-index="${a}"]`);await ui.tap(`#board [data-index="${b}"]`);}
    await ui.until("!document.querySelector('#win').hidden && document.querySelector('#result-gains').textContent.includes('+4')");
    const won=profiles().values[progress];assert(won.done.includes('book-v1-1'));assert.equal(won.jars.meter,4);shot('tutorial50-'+theme+'-win');
    await ui.tap('#play-again');await ui.until("document.querySelector('#mode').textContent.includes('2')");
    stop();ui.close();ui=undefined;assert.equal(profiles().values[progress].active,'book-v1-2');
    launch();ui=await connect();await ui.tap('#resume');await ui.until("document.querySelector('#mode').textContent.includes('2') && !document.querySelector('.opening-copy')");shot('tutorial50-'+theme+'-task2');
    report.cases.push({theme,realFirstTask:true,forceStopImmediatelyAfterAck:true,coldResumeFirstMove:true,lessons,practiceIsolated:true,repeatAndSkip:true,realReward:4,voluntaryTask2:true,task2ColdResume:true});checkpoint();
   }finally{ui?.close();stop();}
  }
  report.status='PASS';checkpoint();
 }catch(error){report.status='ERROR';report.error=String(error);checkpoint();throw error;}
 finally{stop();await fixture(original);}
}
