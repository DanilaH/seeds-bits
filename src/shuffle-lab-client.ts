import type {searchShuffle} from "./shuffle-lab";
export function requestShuffle(board:readonly number[]){
 let stop=()=>{};
 const result=new Promise<ReturnType<typeof searchShuffle>>(resolve=>{
  let worker:Worker|undefined,done=false;
  const finish=(r:ReturnType<typeof searchShuffle>)=>{if(done)return;done=true;clearTimeout(timer);worker?.terminate();resolve(r);};
  const unknown=()=>finish({status:"unknown",stats:{candidates:0,ms:0},proof:undefined});
  const timer=setTimeout(unknown,1000);stop=unknown;
  try{worker=new Worker(new URL("./shuffle-lab-worker.ts",import.meta.url),{type:"module"});worker.onmessage=e=>finish(e.data);worker.onerror=e=>{e.preventDefault();unknown();};worker.postMessage([...board]);}catch{unknown();}
 });return {result,cancel:()=>stop()};
}
