import { compactHintKey } from "./hint-key";
import { packSession, unpackSession } from "./history-codec";
import { jars, addSeeds, taskSeeds, migrateJars, type Jars } from "./jars";
import { validDay } from "./calendar";
import { recordDaily, type DailyRun } from "./daily-run";
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
    (id.startsWith("daily-v1-") &&
      validDay(id.slice(9)) &&
      id.slice(9, 16) >= "2025-01"));
export class FutureProgress extends Error {}
export function readProgress(
  raw: string,
  onRecovery: () => void = () => {},
): Progress {
  const p = JSON.parse(raw);
  if (p?.version > 5 || p?.meta?.version > 2 || p?.jars?.version > 2)
    throw new FutureProgress("Newer save format");
  if (
    (p?.version !== 2 &&
      p?.version !== 3 &&
      p?.version !== 4 &&
      p?.version !== 5) ||
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
        if (p.version >= 4) {
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
        (m?.version !== 1 && m?.version !== 2) ||
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
        if (
          a.hintChoices &&
          typeof a.hintChoices === "object" &&
          !Array.isArray(a.hintChoices)
        ) {
          safe.hintChoices = Object.fromEntries(
            Object.entries(a.hintChoices).filter(
              ([k, v]) =>
                /^h1:[a-f0-9]{64}$/.test(k) &&
                Array.isArray(v) &&
                v.length === 2 &&
                v.every((n) => Number.isSafeInteger(n) && n >= 0 && n < 1800),
            ),
          );
        }
        attempts[id] = safe;
      }
      if (m.version === 1) {
        m.wallet = Object.values(attempts).reduce(
          (n, a) =>
            n +
            Math.max(
              0,
              (a.hintBonus ?? 0) - Math.max(0, (a.hintKeys?.length ?? 0) - 3),
            ),
          0,
        );
        m.version = 2;
      }
      if (!Number.isSafeInteger(m.wallet) || m.wallet < 0)
        throw Error("Invalid hint wallet");
      for (const a of Object.values(attempts)) delete a.hintBonus;
      if (
        m.daily !== undefined &&
        !(
          validDay(m.daily?.lastDay) &&
          Number.isSafeInteger(m.daily.count) &&
          m.daily.count > 0 &&
          Number.isSafeInteger(m.daily.best) &&
          m.daily.best >= m.daily.count &&
          [0, 1, 3].includes(m.daily.reward)
        )
      ) {
        delete m.daily;
        onRecovery();
      }
      if (m.engagement !== undefined) {
        const e = m.engagement;
        if (
          ![e?.activeMs, e?.sessions, e?.reviewAttempts].every(
            (n) => Number.isSafeInteger(n) && n >= 0,
          ) ||
          (e.lastReviewAt !== undefined &&
            (!Number.isFinite(e.lastReviewAt) || e.lastReviewAt < 0))
        ) {
          delete m.engagement;
          onRecovery();
        }
      }
      if (m.flags !== undefined)
        m.flags = Array.isArray(m.flags)
          ? m.flags.filter((v: unknown) => typeof v === "string").slice(0, 30)
          : [];
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
      (j?.version === 1 ||
        (j?.version === 2 && Number.isSafeInteger(j.meter) && j.meter >= 0)) &&
      [j.seeds, j.wins, j.highWater].every(
        (n) => Number.isSafeInteger(n) && n >= 0,
      ) &&
      typeof j.attempt === "string"
    )
      clean.jars = j.version === 1 ? migrateJars(j) : j;
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
  hintChoices?: Record<string, [number, number]>;
};
export type Meta = {
  version: 2;
  wallet: number;
  daily?: DailyRun;
  flags?: string[];
  engagement?: {
    activeMs: number;
    sessions: number;
    reviewAttempts: number;
    lastReviewAt?: number;
    reviewDone?: boolean;
  };
  since: string;
  attempts: Record<string, Attempt>;
  completed: number;
  unassisted: number;
  rewardReceipts?: string[];
};
export function metadata(p: Progress): Meta {
  if (!p.meta) {
    p.meta = {
      version: 2,
      wallet: 0,
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
export function recordCompletion(p: Progress, task: string, now?: string) {
  const m = metadata(p);
  const a =
    m.attempts[task] ??
    (m.attempts[task] = { id: crypto.randomUUID(), completed: false });
  if (a.completed) return { seeds: 0, hints: 0 };
  a.completed = true;
  m.completed++;
  if (!(p.hints[task] ?? 0)) m.unassisted++;
  if (task === "classic") jars(p).wins++;
  let seeds = 0;
  if (task !== "classic" && !p.done.includes(task)) {
    const game = p.sessions[task];
    const first = game?.history[0]?.board ?? game?.current.board ?? [];
    seeds = taskSeeds(occupied(first) / 2);
    addSeeds(p, seeds);
    p.done.push(task);
  }
  return { seeds, hints: recordDaily(p, task, now) };
}

/** Wire v5 prevents older builds from dropping wallet, daily series and the migrated jar curve. */
export function serializeProgress(p: Progress): string {
  return JSON.stringify({
    ...p,
    version: 5,
    sessions: Object.fromEntries(
      Object.entries(p.sessions).map(([id, s]) => [id, packSession(s)]),
    ),
  });
}
