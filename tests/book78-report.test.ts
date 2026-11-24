import {describe,it,expect} from "vitest";
import extra from "../src/notebook-extra.json" with {type:"json"};
import {checkPair,pairs,removePair,occupied} from "../src/core";
import {createSolver} from "../src/solver";

const stored=extra[78-25] as [string,number[]];
const screenshot="000200060600070060006000000085700500064000000";
const board=[...stored[0]].map(Number);

describe("phone report 2026-11-23 / notebook 4 puzzle 6 / book-v1-78",()=>{
  it("the screenshot is the exact untouched 12-number published start",()=>{
    expect(stored[0]).toBe(screenshot);
    expect(board.length).toBe(45);
    expect(occupied(board)).toBe(12);
    expect(pairs(board).map(({a,b})=>[a,b])).toEqual([[7,9],[7,16],[16,20],[37,38]]);
  });
  it("both marked pairs are clickable by the pair rules; upper vertical pair leads to a dead branch",()=>{
    expect(checkPair(board,7,16).ok).toBe(true);
    expect(checkPair(board,37,38).ok).toBe(true);
    expect(createSolver(50000)(removePair(board,7,16))).toEqual({kind:"dead"});
    expect(createSolver(50000)(removePair(board,37,38)).kind).toBe("move");
  });
  it("the published six-move witness clears the board; hint chooses a winning pair",()=>{
    let current=board;
    const witness=[] as {a:number;b:number;kind:"straight"|"reading"}[];
    for(let i=0;i<stored[1].length;i+=3){
      const [a,b,kind]=stored[1].slice(i,i+3);
      const outcome=checkPair(current,a,b);
      expect(outcome.ok).toBe(true);
      if(!outcome.ok)throw Error("invalid stored witness");
      expect(outcome.path.kind).toBe(kind?"reading":"straight");
      witness.push(outcome.path);
      current=removePair(current,a,b);
    }
    expect(witness).toHaveLength(6);
    expect(occupied(current)).toBe(0);
    expect(createSolver(50000,{board,solution:witness})(board)).toEqual({kind:"move",pair:witness[0]});
  });
});
