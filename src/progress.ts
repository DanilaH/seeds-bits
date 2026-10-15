import { decode, newSession, type Session } from "./core";
export type Progress = {
  version: 2;
  active: string;
  sessions: Record<string, Session>;
  hints: Record<string, number>;
  done: string[];
  seen: string[];
};
export const fresh = (): Progress => ({
  version: 2,
  active: "classic",
  sessions: { classic: newSession() },
  hints: {},
  done: [],
  seen: [],
});
const validId = (id: string) =>
  id === "classic" ||
  /^book-v1-([1-9]|1\d|2[0-4])$/.test(id) ||
  /^daily-v1-\d{4}-\d{2}-\d{2}$/.test(id);
export function readProgress(raw: string): Progress {
  const p = JSON.parse(raw);
  if (
    p?.version !== 2 ||
    !validId(p.active) ||
    !p.sessions ||
    !Array.isArray(p.done) ||
    !Array.isArray(p.seen)
  )
    throw Error("Invalid progress");
  const clean = fresh();
  for (const [id, s] of Object.entries(p.sessions))
    if (validId(id)) clean.sessions[id] = decode(JSON.stringify(s));
  clean.active = clean.sessions[p.active] ? p.active : "classic";
  clean.done = [
    ...new Set<string>(
      p.done.filter(
        (x: unknown) => typeof x === "string" && validId(x) && x !== "classic",
      ),
    ),
  ];
  clean.seen = p.seen
    .filter((x: unknown) => typeof x === "string")
    .slice(0, 100);
  for (const [id, n] of Object.entries(p.hints ?? {}))
    if (validId(id) && Number.isSafeInteger(n) && Number(n) >= 0)
      clean.hints[id] = Number(n);
  return clean;
}
