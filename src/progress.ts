import { validContentId, legacyBookNumber, pilotBookId, dailyDay, dailyDone, readDailyAssignments, knownDailyAssignments, readBookRevisions, knownBookRevisions, knownIds, versionedDay, type BookRevision } from "./content-ids";
import { freshHelp, readHelp, readHelpAttempt, type HelpProfile, type HelpAttempt } from "./help-contract";
import { compactHintKey } from "./hint-key";
import { readAnalytics, type AnalyticsJournal } from "./analytics";
import { packSession, unpackSession } from "./history-codec";
import { jars, addSeeds, taskSeeds, migrateJars, type Jars } from "./jars";
import { validDay } from "./calendar";
import { recordDaily, type DailyRun } from "./daily-run";
import { decode, newSession, occupied, type Session } from "./core";
import { readClassicDeals, type ClassicDeals } from "./classic-deals";
import { readClassicRun, type ClassicRun } from "./classic-generator";
export type Progress = {
  version: 3;
  dailyAssignments?: Record<string,string>;
  bookRevisions?: Record<string,BookRevision>;
  active: string;
  lastBookTask?: string;
  bookPlayOrder?: string[];
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
const validId = validContentId;
export class FutureProgress extends Error {}
export class ProtectedContentProgress extends FutureProgress {}
export function readProgress(
  raw: string,
  onRecovery: () => void = () => {},
): Progress {
  const p = JSON.parse(raw);
  if (p?.version > 10 || p?.meta?.version > 2 || p?.jars?.version > 2 || p?.meta?.help?.version > 1 || Object.values(p?.meta?.attempts ?? {}).some((a: any) => a?.help?.version > 1))
    throw new FutureProgress("Newer save format");
  if (
    (p?.version !== 2 &&
      p?.version !== 3 &&
      p?.version !== 4 &&
      p?.version !== 5 &&
      p?.version !== 6 &&
      p?.version !== 7 &&
      p?.version !== 8 &&
      p?.version !== 9 &&
      p?.version !== 10) ||
    !validId(p.active) ||
    !p.sessions ||
    !Array.isArray(p.done) ||
    !Array.isArray(p.seen)
  )
    throw p?.version >= 8 ? new ProtectedContentProgress("Invalid protected save") : Error("Invalid progress");
  if (p.version >= 6) {
    try {
      if (p.meta?.help !== undefined) readHelp(p.meta.help);
      for (const a of Object.values(p.meta?.attempts ?? {}) as any[]) if (a.help !== undefined) readHelpAttempt(a.help);
    } catch { throw new FutureProgress("Protected assistance data could not be read"); }
  }
  const clean = fresh();
  try {
    const explicit=p.bookRevisions===undefined?{}:readBookRevisions(p.bookRevisions);
    if (Object.values(explicit).some(rev =>
      (rev === 4 && p.version < 8) || (rev === 5 && p.version < 9) || (rev === 6 && p.version < 10)))
      throw Error("Unprotected notebook identity");
    // Pin identities from the raw save BEFORE optional recovery drops damaged boards/metadata.
    const books=knownBookRevisions({...p,bookRevisions:explicit},p.version>=8);
    if(Object.keys(books).length)clean.bookRevisions=books;
    const days=knownDailyAssignments({...p,dailyAssignments:p.dailyAssignments===undefined?{}:readDailyAssignments(p.dailyAssignments)});
    const dateIds = [...knownIds(p), ...Object.values(days)];
    if (dateIds.some(id => id.startsWith("daily-v5-") && p.version < 9))
      throw Error("Unprotected daily identity");
    if (p.version >= 8 && dateIds.some(id => id.startsWith("daily-") && !dailyDay(id)))
      throw Error("Invalid daily task identity");
    if(Object.keys(days).length)clean.dailyAssignments=days;
  } catch { throw new ProtectedContentProgress("Protected content identities could not be read"); }
  for (const [id, s] of Object.entries(p.sessions))
    if (validId(id)) {
      try {
        if (p.version >= 4) {
          try {
            clean.sessions[id] = unpackSession(s);
          } catch {
            if (p.version >= 9) throw new ProtectedContentProgress("Protected history could not be read");
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
      } catch (error) {
        if (p.version >= 9) throw error;
        onRecovery();
      }
    }
  if (p.version >= 9 && !clean.sessions[p.active])
    throw new ProtectedContentProgress("Missing assigned field");
  clean.active = clean.sessions[p.active] ? p.active : "classic";
  if (typeof p.lastBookTask === "string" &&
      (legacyBookNumber(p.lastBookTask) || pilotBookId(p.lastBookTask)) &&
      clean.sessions[p.lastBookTask]) clean.lastBookTask = p.lastBookTask;
  if (Array.isArray(p.bookPlayOrder)) {
    clean.bookPlayOrder = [...new Set<string>(p.bookPlayOrder.filter((id: unknown) =>
      typeof id === "string" && (legacyBookNumber(id) || pilotBookId(id)) &&
      Object.hasOwn(clean.sessions, id)))];
  }
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
        if (a.help !== undefined) safe.help = readHelpAttempt(a.help);
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
      if (!["fresh-v2", "legacy"].includes(m.analyticsCohort))
        delete m.analyticsCohort;
      if (m.analytics !== undefined) m.analytics = readAnalytics(m.analytics);
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
      if (m.classicDeals !== undefined) {
        const deals = readClassicDeals(m.classicDeals);
        if (deals) m.classicDeals = deals;
        else {
          delete m.classicDeals;
          onRecovery();
        }
      }
      if (m.classicRun !== undefined) {
        const run = readClassicRun(m.classicRun);
        if (run) m.classicRun = run;
        else {
          delete m.classicRun;
          onRecovery();
        }
      }
      if (m.help !== undefined) m.help = readHelp(m.help);
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
  help?: HelpAttempt;
};
export type Meta = AnalyticsJournal & {
  help?: HelpProfile;
  analyticsCohort?: "fresh-v2" | "legacy";
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
  classicDeals?: ClassicDeals;
  classicRun?: ClassicRun;
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
  if (!(p.hints[task] ?? 0) && !a.help?.assisted) m.unassisted++;
  if (task === "classic") jars(p).wins++;
  let seeds = 0;
  const day = dailyDay(task);
  const alreadyDay = day !== undefined && dailyDone(p.done, day);
  const alreadyTask = p.done.includes(task);
  if (task !== "classic" && !alreadyTask && !alreadyDay) {
    const game = p.sessions[task];
    const first = game?.history[0]?.board ?? game?.current.board ?? [];
    seeds = taskSeeds(occupied(first) / 2);
    addSeeds(p, seeds);
    p.done.push(task);
  }
  return { seeds, hints: alreadyDay && !alreadyTask ? 0 : recordDaily(p, task, now) };
}

/** Wire 9 protects v5 identities. Wire 10 also protects the opening overlay. */
export function serializeProgress(p: Progress): string {
  const bookRevisions=knownBookRevisions(p);
  const dailyAssignments=knownDailyAssignments(p);
  const ids=[p.active,...Object.keys(p.sessions),...p.done,...Object.keys(p.hints),...Object.keys(p.meta?.attempts??{}),...Object.values(dailyAssignments)];
  const revisions = Object.values(bookRevisions);
  const version=revisions.includes(6)?10:
    revisions.includes(5)||ids.some(id=>id.startsWith("daily-v5-"))||
    Object.keys(dailyAssignments).some(day=>!versionedDay(day))?9:
    Object.keys(bookRevisions).length||ids.some(id=>id.startsWith("daily-v4-"))?8:
    Object.keys(dailyAssignments).length||ids.some(id=>/^(book|daily)-v3-/.test(id))?7:6;
  return JSON.stringify({
    ...p,
    version,
    bookRevisions:Object.keys(bookRevisions).length?bookRevisions:undefined,
    dailyAssignments:Object.keys(dailyAssignments).length?dailyAssignments:undefined,
    sessions: Object.fromEntries(
      Object.entries(p.sessions).map(([id, s]) => [id, packSession(s)]),
    ),
  });
}

export function helpProfile(p: Progress): HelpProfile {
  return (metadata(p).help ??= freshHelp());
}
export function cloneProgress(p: Progress): Progress { return readProgress(serializeProgress(p)); }
