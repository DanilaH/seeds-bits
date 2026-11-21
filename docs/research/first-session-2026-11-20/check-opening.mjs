import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { checkPair, occupied, pairs, removePair, WIDTH } from "../../../src/core.ts";
const tasks = JSON.parse(await readFile(new URL("../../../src/notebook.json", import.meta.url)));
function walk(board, usedGap, usedEdge, counts) {
  if (!occupied(board)) {
    counts.wins++;
    if (usedGap) counts.winsWithGap++;
    if (usedEdge) counts.winsWithEdge++;
    return;
  }
  const moves = pairs(board);
  if (!moves.length) counts.deadEnds++;
  for (const { a, b, kind } of moves) {
    const distance = Math.max(Math.abs(a % WIDTH - b % WIDTH), Math.abs(Math.floor(a / WIDTH) - Math.floor(b / WIDTH)));
    walk(removePair(board, a, b), usedGap || (kind === "straight" && distance > 1), usedEdge || kind === "reading", counts);
  }
}
function hasStraightWin(board, seen = new Set()) {
  if (!occupied(board)) return true;
  const key = board.join(",");
  if (seen.has(key)) return false;
  seen.add(key);
  return pairs(board).some(({a, b, kind}) => kind === "straight" && hasStraightWin(removePair(board, a, b), seen));
}
const counts = {wins:0, deadEnds:0, winsWithGap:0, winsWithEdge:0};
walk(tasks[0].board, false, false, counts);
const firstFive = tasks.slice(0, 5).map(task => {
  let board = task.board;
  for (const {a, b} of task.solution) {
    assert.ok(checkPair(board, a, b).ok);
    board = removePair(board, a, b);
  }
  assert.equal(occupied(board), 0);
  return { id: task.id, hasStraightWin: hasStraightWin(task.board) };
});
const opening = {id:tasks[0].id, firstMoves:pairs(tasks[0].board).length, ...counts};
assert.deepEqual(Object.values(counts), [44, 0, 44, 8]);
assert.deepEqual(firstFive.map(x => x.hasStraightWin), [true,true,true,true,false]);
console.log(JSON.stringify({opening,firstFive},null,2));
