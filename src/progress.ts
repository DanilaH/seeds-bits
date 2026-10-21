import { compactHintKey } from "./hint-key";
import { packSession, unpackSession } from "./history-codec";
import { jars, type Jars } from "./jars";
import { decode, newSession, occupied, type Session } from "./core";
export type Progress = {
  version: 3;
  active: string;
  sessions: Record<string, Session>;
  hints: Record<string, number>;
  done: string[];
  seen: string[];
  meta?: Meta;
  jars?: Jars;
};
export const fresh = (): Progress => ({
  version: 3,
  active: "classic",
  sessions: { classic: newSession() },
  hints: {},
  done: [],
  seen: [],
});
const validId = (id: string) =>
  typeof id === "string" &&
  (id === "classic" ||
    (/^book-v1-[1-9]\d*$/.test(id) && Number(id.slice(8)) <= 2400) ||
    /^daily-v1-\d{4}-\d{2}-\d{2}$/.test(id));
export class FutureProgress extends Error {}
export function readProgress(
  raw: string,
  onRecovery: () => void = () => {},
): Progress {
  const p = JSON.parse(raw);
  if (p?.version > 4 || p?.meta?.version > 1 || p?.jars?.version > 1)
    throw new FutureProgress("Newer save format");
  if (
    (p?.version !== 2 && p?.version !== 3 && p?.version !== 4) ||
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
        if (p.version === 4) {
          try {
            clean.sessions[id] = unpackSession(s);
          } catch {
            const packed = s as { rules: number; current: unknown };
            clean.sessions[id] = decode(
              JSON.stringify({
                rules: packed?.rules,
                current: packed?.current,
                history: [],
              }),
            );
            onRecovery();
          }
        } else clean.sessions[id] = decode(JSON.stringify(s));
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
    try {
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
      const attempts: Record<string, Attempt> = {};
      for (const [id, value] of Object.entries(m.attempts)) {
        const a = value as Attempt;
        if (
          !validId(id) ||
          !a ||
          typeof a.id !== "string" ||
          typeof a.completed !== "boolean"
        ) {
          onRecovery();
          continue;
        }
        const safe: Attempt = { id: a.id, completed: a.completed };
        if (typeof a.analyticsStarted === "boolean")
          safe.analyticsStarted = a.analyticsStarted;
        if (a.hintBonus !== undefined) {
          if (Number.isSafeInteger(a.hintBonus) && a.hintBonus >= 0)
            safe.hintBonus = a.hintBonus;
          else onRecovery();
        }
        if (a.hintKeys !== undefined) {
          if (Array.isArray(a.hintKeys)) {
            safe.hintKeys = a.hintKeys.map((key, index) => {
              if (typeof key === "string" && key.length <= 4000)
                return compactHintKey(key);
              // Keep the used credit while recovering the rest of this attempt.
              onRecovery();
              return `recovered:${index}`;
            });
          } else onRecovery();
        }
        attempts[id] = safe;
      }
      m.attempts = attempts;
      if (m.rewardReceipts !== undefined) {
        if (Array.isArray(m.rewardReceipts)) {
          m.rewardReceipts = m.rewardReceipts.filter((token: unknown) => {
            const valid =
              typeof token === "string" &&
              token.length > 0 &&
              token.length <= 100;
            if (!valid) onRecovery();
            return valid;
          });
        } else {
          delete m.rewardReceipts;
          onRecovery();
        }
      }
      clean.meta = m;
    } catch {
      // Statistics are optional; keep valid boards, completion marks and trophies.
      onRecovery();
    }
  }
  metadata(clean);
  if (p.jars !== undefined) {
    const j = p.jars;
    if (
      j?.version === 1 &&
      [j.seeds, j.wins, j.highWater].every(
        (n) => Number.isSafeInteger(n) && n >= 0,
      ) &&
      typeof j.attempt === "string"
    )
      clean.jars = j;
    else onRecovery();
  }
  const jar = jars(clean),
    attempt = metadata(clean).attempts.classic?.id ?? "legacy";
  if (jar.attempt !== attempt) {
    jar.attempt = attempt;
    jar.highWater = Math.max(
      jar.highWater,
      clean.sessions.classic.current.moves,
    );
  }
  return clean;
}

export type Attempt = {
  id: string;
  completed: boolean;
  analyticsStarted?: boolean;
  hintBonus?: number;
  hintKeys?: string[];
};
export type Meta = {
  version: 1;
  since: string;
  attempts: Record<string, Attempt>;
  completed: number;
  unassisted: number;
  rewardReceipts?: string[];
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
  if (task === "classic") {
    const j = jars(p);
    j.attempt = metadata(p).attempts.classic.id;
    j.highWater = 0;
  }
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
  if (task === "classic") jars(p).wins++;
  if (task !== "classic" && !p.done.includes(task)) p.done.push(task);
}

/** Wire v4 prevents older builds from silently dropping compact undo history. */
export function serializeProgress(p: Progress): string {
  return JSON.stringify({
    ...p,
    version: 4,
    sessions: Object.fromEntries(
      Object.entries(p.sessions).map(([id, s]) => [id, packSession(s)]),
    ),
  });
}
