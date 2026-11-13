import type {SearchResult} from "./help-search";
export function requestHelp(board: readonly number[], kind: "magnet" | "plan") {
  let stop = () => {};
  const result = new Promise<SearchResult>(resolve => {
    let worker: Worker | undefined, finished = false;
    const done = (value: SearchResult) => {if(finished)return; finished=true;clearTimeout(timer);worker?.terminate();resolve(value);};
    const fallback = () => done({status:"unknown",stats:{candidates:0,nodes:0,ms:0,limited:true}});
    const timer=setTimeout(fallback,1000);stop=fallback;
    try {
      worker=new Worker(new URL("./help-worker.ts",import.meta.url),{type:"module"});
      worker.onmessage=e=>done(e.data);worker.onerror=e=>{e.preventDefault();fallback();};
      worker.postMessage({board:[...board],kind});
    } catch {fallback();}
  });
  return {result,cancel:()=>stop()};
}
