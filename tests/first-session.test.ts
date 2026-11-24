import {describe,it,expect} from "vitest";
import notebook from "../src/notebook.json";
import {openingSelection,requiredRule,taskDate} from "../src/first-session";
import {pairs,removePair} from "../src/core";
describe("first-session commands from the legal field",()=>{
  const board=notebook[0].board;
  const expected: Record<number,string>={
    4:"Ещё 9 или 1.\n9 + 1 = 10.", 5:"Ещё 1 или 9.\n1 + 9 = 10.",
    7:"Найдите ещё одну 1.",8:"Найдите 4: 6 + 4 = 10.",9:"Найдите ещё одну 3.",
    11:"Найдите ещё одну 3.",14:"Ещё 9 или 1.\n9 + 1 = 10.",17:"Найдите 6: 4 + 6 = 10.",
  };
  for(const [i,text] of Object.entries(expected))it(`legal first choice ${i}`,()=>expect(openingSelection(board,+i)).toBe(text));
  it("never offers a numerically fitting but blocked partner",()=>expect(openingSelection([1,2,1],0)).toBe("У этой цифры пока нет пары. Выберите другую."));
  it("introduces a gap before the required pair and then the edge",()=>{
    const afterTwo=removePair(removePair(board,8,17),4,5);
    expect(requiredRule(pairs(afterTwo))).toBe("Пустые клетки можно пропускать.");
    expect(requiredRule(pairs(removePair(afterTwo,9,11)))).toBe("От правого края — в начало строки ниже.");
  });
  it("formats the opened task date, independent of timezone/day",()=>expect(taskDate("2026-11-19")).toBe("19 ноября"));
});
