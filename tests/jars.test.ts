import { test, expect } from "vitest";
import {
  fresh,
  metadata,
  readProgress,
  startAttempt,
  recordCompletion,
} from "../src/progress";
import { jars, collectPair, jarState, jarCapacity } from "../src/jars";
test("0.4.1 migration keeps boards and wins but never invents historical seeds", () => {
  const old = { ...fresh(), version: 2 };
  old.sessions.classic.current.moves = 10;
  old.done = ["book-v1-24"];
  const p = readProgress(JSON.stringify(old));
  expect(p.version).toBe(3);
  expect(p.done).toEqual(old.done);
  expect(jars(p).seeds).toBe(0);
  expect(collectPair(p, 10)).toBe(0);
  expect(collectPair(p, 11)).toBe(2);
});
test("undo, branches, reload and double win cannot farm rewards; explicit new attempt can", () => {
  let p = fresh();
  metadata(p);
  jars(p);
  collectPair(p, 1);
  collectPair(p, 2);
  expect(collectPair(p, 1)).toBe(0);
  p = readProgress(JSON.stringify(p));
  expect(collectPair(p, 2)).toBe(0);
  expect(collectPair(p, 3)).toBe(2);
  recordCompletion(p, "classic");
  recordCompletion(p, "classic");
  expect(jars(p).wins).toBe(1);
  startAttempt(p, "classic");
  collectPair(p, 1);
  recordCompletion(p, "classic");
  expect(jars(p).seeds).toBe(8);
  expect(jars(p).wins).toBe(2);
});
test("every jar threshold is exact, increasing then bounded, with unlimited progression", () => {
  let total = 0;
  for (let i = 0; i < 1000; i++) {
    expect(jarState(total)).toMatchObject({ index: i, filled: 0 });
    expect(jarState(total + jarCapacity(i) - 1).index).toBe(i);
    total += jarCapacity(i);
  }
  expect(jarState(total).index).toBe(1000);
  expect(jarCapacity(0)).toBe(24);
  expect(jarCapacity(99)).toBe(2000);
});
test("corrupt jars recover without deleting notebook 2400; future jars are protected", () => {
  const p = fresh();
  p.done = ["book-v1-2400"];
  const r = readProgress(
    JSON.stringify({ ...p, jars: { version: 1, seeds: -1 } }),
  );
  expect(r.done).toEqual(p.done);
  expect(jars(r).seeds).toBe(0);
  expect(() =>
    readProgress(JSON.stringify({ ...p, jars: { version: 2 } })),
  ).toThrow();
});
test("restart saved before the first move still earns, while metadata repair cannot reset credited depth", () => {
  let p = fresh();
  metadata(p);
  jars(p);
  collectPair(p, 8);
  startAttempt(p, "classic");
  p = readProgress(JSON.stringify(p));
  expect(collectPair(p, 1)).toBe(2);
  collectPair(p, 10);
  p.meta!.completed = -1;
  p = readProgress(JSON.stringify(p));
  expect(collectPair(p, 9)).toBe(0);
  expect(collectPair(p, 11)).toBe(2);
});
