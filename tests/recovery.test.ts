import { it, expect } from "vitest";
import { fresh, readProgress } from "../src/progress";
it("one malformed task does not erase valid games and completion marks", () => {
  const p = fresh();
  p.sessions.classic.current.moves = 7;
  p.done = ["book-v1-2"];
  const raw = {
    ...p,
    active: "book-v1-1",
    sessions: { ...p.sessions, "book-v1-1": { broken: true } },
  };
  const restored = readProgress(JSON.stringify(raw));
  expect(restored.active).toBe("classic");
  expect(restored.sessions.classic.current.moves).toBe(7);
  expect(restored.done).toEqual(["book-v1-2"]);
});
it("damaged optional statistics preserve valid sessions, history and trophies", () => {
  const p = fresh();
  p.done = ["book-v1-2", "daily-v1-2026-10-20"];
  p.sessions.classic.current.moves = 17;
  let recovered = 0;
  const restored = readProgress(
    JSON.stringify({ ...p, meta: { version: 1, completed: -1 } }),
    () => recovered++,
  );
  expect(restored.done).toEqual(p.done);
  expect(restored.sessions).toEqual(p.sessions);
  expect(restored.meta?.completed).toBe(0);
  expect(recovered).toBe(1);
});
