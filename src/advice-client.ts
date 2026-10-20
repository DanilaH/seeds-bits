import type { Advice } from "./solver";
import type { Board, Snapshot } from "./core";
import type { Puzzle } from "./puzzles";
export function requestAdvice(
  board: Board,
  history: Snapshot[],
  puzzle: Puzzle,
): Promise<{ advice: Advice; recovery: number }> {
  return new Promise((resolve) => {
    let worker: Worker | undefined;
    const done = (result: { advice: Advice; recovery: number }) => {
      clearTimeout(timer);
      worker?.terminate();
      resolve(result);
    };
    const fallback = () => done({ advice: { kind: "unknown" }, recovery: -1 });
    const timer = setTimeout(fallback, 2500);
    try {
      worker = new Worker(new URL("./advice-worker.ts", import.meta.url), {
        type: "module",
      });
      worker.onmessage = (e) => done(e.data);
      worker.onerror = (event) => {
        event.preventDefault();
        fallback();
      };
      worker.postMessage({ board, history, puzzle });
    } catch {
      fallback();
    }
  });
}
