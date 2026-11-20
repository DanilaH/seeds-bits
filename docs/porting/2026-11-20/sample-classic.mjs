// Run from the project root with its locked dependencies installed.
import { createServer } from "vite";

const server = await createServer({
  configFile: false,
  appType: "custom",
  server: { middlewareMode: true, hmr: false },
  logLevel: "error",
});
try {
  const { pairs, removePair, addNumbers } = await server.ssrLoadModule("/src/core.ts");
  const { newClassicRun, generateClassic } = await server.ssrLoadModule("/src/classic-generator.ts");
  const starts = new Set();
  const count = 512;
  const results = {};
  const strategies = {
    first: moves => moves[0],
    last: moves => moves[moves.length - 1],
    deterministicSample: (moves, next) => moves[Math.floor((next() / 2**32) * moves.length)],
  };
  for (const name of Object.keys(strategies)) {
    results[name] = { clearedWithoutAdd: 0, firstDeadEnds: 0, noPairAfterFirstAdd: 0, noPairAfterSecondAdd: 0 };
  }
  for (let seed = 0; seed < count; seed++) {
    const start = generateClassic(newClassicRun(seed), 1).board;
    starts.add(start.join(","));
    for (const [name, choose] of Object.entries(strategies)) {
      let board = start;
      let state = (seed ^ 0x83c7e417) >>> 0;
      const next = () => (state = (Math.imul(state, 1664525) + 1013904223) >>> 0);
      const result = results[name];
      while (board.some(Boolean)) {
        const allowed = pairs(board);
        if (!allowed.length) {
          result.firstDeadEnds++;
          const after = addNumbers(board);
          if (!pairs(after).length) {
            result.noPairAfterFirstAdd++;
            if (!pairs(addNumbers(after)).length) result.noPairAfterSecondAdd++;
          }
          break;
        }
        const { a, b } = choose(allowed, next);
        board = removePair(board, a, b);
      }
      if (!board.some(Boolean)) result.clearedWithoutAdd++;
    }
  }
  for (const result of Object.values(results)) {
    if (result.firstDeadEnds + result.clearedWithoutAdd !== count) {
      throw Error("Incomplete sample");
    }
  }
  console.log(JSON.stringify({ difficulty: "ordinary", firstSeed: 0, seeds: count, distinctBoards: starts.size, results }, null, 2));
} finally {
  await server.close();
}
