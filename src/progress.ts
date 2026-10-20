import { decode, newSession, occupied, type Session } from "./core";
export type Progress = {
  version: 2;
  active: string;
  sessions: Record<string, Session>;
  hints: Record<string, number>;
  done: string[];
  seen: string[];
  meta?: Meta;
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
  typeof id === "string" &&
  (id === "classic" ||
    /^book-v1-([1-9]|1\d|2[0-4])$/.test(id) ||
    /^daily-v1-\d{4}-\d{2}-\d{2}$/.test(id));
export function readProgress(
  raw: string,
  onRecovery: () => void = () => {},
): Progress {
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
    if (validId(id)) {
      try {
        clean.sessions[id] = decode(JSON.stringify(s));
      } catch {
        onRecovery();
      }
    }
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
  if (p.meta !== undefined) {
    const m = p.meta;
    if (
      m?.version !== 1 ||
      typeof m.since !== "string" ||
      !Number.isFinite(Date.parse(m.since)) ||
      !Number.isSafeInteger(m.completed) ||
      m.completed < 0 ||
      !Number.isSafeInteger(m.unassisted) ||
      m.unassisted < 0 ||
      m.unassisted > m.completed ||
      !m.attempts ||
      typeof m.attempts !== "object" ||
      Array.isArray(m.attempts)
    )
      throw Error("Invalid statistics");
    for (const [id, value] of Object.entries(m.attempts)) {
      const a = value as Attempt;
      if (
        !validId(id) ||
        !a ||
        typeof a.id !== "string" ||
        typeof a.completed !== "boolean"
      )
        throw Error("Invalid attempt");
    }
    clean.meta = m;
  }
  metadata(clean);
  return clean;
}

export type Attempt = { id: string; completed: boolean };
export type Meta = {
  version: 1;
  since: string;
  attempts: Record<string, Attempt>;
  completed: number;
  unassisted: number;
};
export function metadata(p: Progress): Meta {
  if (!p.meta) {
    p.meta = {
      version: 1,
      since: new Date().toISOString(),
      attempts: {},
      completed: 0,
      unassisted: 0,
    };
    // Historical wins remain unique progress, not invented attempt statistics.
    for (const [id, session] of Object.entries(p.sessions))
      p.meta.attempts[id] = {
        id: crypto.randomUUID(),
        completed: !occupied(session.current.board),
      };
  }
  return p.meta;
}
export function startAttempt(p: Progress, task: string) {
  metadata(p).attempts[task] = { id: crypto.randomUUID(), completed: false };
}
export function recordCompletion(p: Progress, task: string) {
  const m = metadata(p);
  const a =
    m.attempts[task] ??
    (m.attempts[task] = { id: crypto.randomUUID(), completed: false });
  if (a.completed) return;
  a.completed = true;
  m.completed++;
  if (!(p.hints[task] ?? 0)) m.unassisted++;
  if (task !== "classic" && !p.done.includes(task)) p.done.push(task);
}
