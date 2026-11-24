import b1 from "./content-v4-books-1.json" with {type:"json"};
import b2 from "./content-v4-books-2.json" with {type:"json"};
import b3 from "./content-v4-books-3.json" with {type:"json"};
import b4 from "./content-v4-books-4.json" with {type:"json"};
import dates from "./content-v4-daily.json" with {type:"json"};
import {checkPair,removePair,occupied,type Connection} from "./core";
import {legacyBookNumber,dailyDay,dailyV4Index} from "./content-ids";
import type {Puzzle} from "./puzzles";
const books=[...b1,...b2,...b3,...b4];
const A="0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_";
const cache=new Map<string,Puzzle>();
function decode(id:string,row:string[]):Puzzle {
  const [digits,proof]=row;
  const board=[...digits].map(Number);
  const solution:Connection[]=[];
  let current=board;
  if(proof.length%2)throw Error("Incomplete content proof: "+id);
  for(let i=0;i<proof.length;i+=2){
    const r=checkPair(current,A.indexOf(proof[i]),A.indexOf(proof[i+1]));
    if(!r.ok)throw Error("Invalid content proof: "+id);
    solution.push(r.path);current=removePair(current,r.path.a,r.path.b);
  }
  if(occupied(current))throw Error("Incomplete solution: "+id);
  return {id,board,solution};
}
export function bookV4(id:string):Puzzle|undefined {
  const n=legacyBookNumber(id);if(!n)return;
  let p=cache.get(id);if(!p){p=decode(id,books[n-1]);cache.set(id,p)}return p;
}
export function bankDailyV4(id:string):Puzzle|undefined {
  if(!id.startsWith("daily-v4-"))return;
  const day=dailyDay(id);if(!day)return;
  const i=dailyV4Index(day);return i>=0&&i<dates.length?decode(id,dates[i]):undefined;
}
export const bookV4Count=books.length,dailyV4Count=dates.length;
