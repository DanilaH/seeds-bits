// Run against a Vite dev server for the revision being measured.
import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const [base, output] = process.argv.slice(2);
if (!base || !output) throw Error("Usage: node scripts/measure-notebook-hints.mjs VITE_URL OUTPUT.json");
const cases = JSON.parse(readFileSync(new URL("../tests/hint-repair-cases.json", import.meta.url)));
const browser = await chromium.launch({
  executablePath: process.env.SEEDS_CHROMIUM,
  args: ["--no-sandbox"],
});
try {
  const page = await browser.newPage();
  await page.goto(base);
  const results = await page.evaluate(async cases => {
    const { createSolver } = await import("/src/solver.ts");
    const { bookV5, loadBookV5 } = await import("/src/content-v5.ts");
    const { requestAdvice } = await import("/src/advice-client.ts");
    const { removePair, occupied } = await import("/src/core.ts");
    const results = [];
    for (const [slot,first,,oldUnknown] of cases) {
      const id = "book-v1-" + slot;
      await loadBookV5(id);
      const puzzle = bookV5(id);
      const board = removePair(puzzle.board,...first);
      const history = [{board:puzzle.board,scroll:0,additions:0,moves:0}];
      const directStart = performance.now();
      const direct = createSolver(occupied(board)>100?2000:50000,puzzle)(board,history);
      const directMs = performance.now() - directStart;
      const workerStart = performance.now();
      const { advice, recovery } = await requestAdvice(board,history,puzzle);
      results.push({n:slot, first, oldUnknown, direct:direct.kind, directMs, worker:advice.kind,
        workerMs:performance.now()-workerStart, recovery, pair:advice.pair});
    }
    return results;
  },cases);
  writeFileSync(output,JSON.stringify(results,null,2)+"\n");
} finally {
  await browser.close();
}
