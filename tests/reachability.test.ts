import {describe,it,expect} from "vitest";
import {reachableNumbers,checkPair} from "../src/core";

describe("selected number visibility",()=>{
  it("lights the first number on all eight rays, regardless of value",()=>{
    const board=Array(81).fill(0);
    for(const [i,v] of [[40,4],[20,1],[22,2],[24,3],[38,4],[42,6],[56,7],[58,8],[60,9],[0,6],[4,6],[8,6],[36,6],[44,6],[72,6],[76,6],[80,6]]) board[i]=v;
    expect(reachableNumbers(board,40)).toEqual([20,22,24,38,42,56,58,60]);
    expect(checkPair(board,40,20).ok).toBe(false);
  });
  it("includes reading neighbours across edges and stops at occupied blockers",()=>{
    expect(reachableNumbers([0,0,6,0,0,0,0,4,1],2,3)).toEqual([7,8]);
    expect(reachableNumbers([0,0,6,0,0,0,0,4,1],7,3)).toEqual([2,8]);
    expect(reachableNumbers([4,1,6],0)).toEqual([1]);
    for(const from of [-1,0,1,1.5,99]) expect(reachableNumbers([0,0],from)).toEqual([]);
  });
  it("matches the existing geometric rules across sparse, partial and narrow boards without mutation",()=>{
    let seed=271828;
    const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
    for(const width of [1,3,9]) for(let n=0;n<100;n++) {
      const board=Array.from({length:1+Math.floor(random()*100)},()=>random()<.55?0:1+Math.floor(random()*9));
      const before=[...board],neutral=board.map(v=>v?5:0);
      for(let from=0;from<board.length;from++) if(board[from]) {
        const expected=neutral.flatMap((v,to)=>v && checkPair(neutral,from,to,width).ok?[to]:[]);
        expect(reachableNumbers(board,from,width)).toEqual(expected);
      }
      expect(board).toEqual(before);
    }
  });
});
