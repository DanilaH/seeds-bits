import { validDay, dayNumber } from "./calendar";
export const PILOT_START = "2026-12-01";
export const PILOT_END = "2026-12-24";
export const LEGACY_BOOK_TASKS = 2400;
export const PILOT_THEMES = ["links", "choice", "shift", "mix"] as const;
export function pilotBookId(id: string) {
  return /^book-v3-(links|choice|shift|mix)-([1-9]|1\d|2[0-4])$/.test(id);
}
export function pilotDayIndex(day: string) {
  return validDay(day) && day >= PILOT_START && day <= PILOT_END ? dayNumber(day)-dayNumber(PILOT_START) : -1;
}
export function dailyDay(id: string): string | undefined {
  if (typeof id !== "string" || !/^daily-v[13]-/.test(id)) return;
  const day = id.slice(9);
  if (!validDay(day) || day < "2025-01-01" || (id.startsWith("daily-v3-") && pilotDayIndex(day)<0)) return;
  return day;
}
export function validContentId(id: string) {
  return typeof id === "string" && (id === "classic" ||
    (/^book-v1-[1-9]\d*$/.test(id) && Number(id.slice(8)) <= LEGACY_BOOK_TASKS) ||
    pilotBookId(id) || dailyDay(id) !== undefined);
}
export function dailyDone(done: readonly string[], day: string) {
  return done.includes("daily-v1-"+day) || (pilotDayIndex(day)>=0 && done.includes("daily-v3-"+day));
}
type IdentityState = {
  active?: string;
  done: readonly string[];
  sessions: Record<string, unknown>;
  hints: Record<string, unknown>;
  meta?: { attempts: Record<string, unknown> };
  dailyAssignments?: Record<string, string>;
};
export function dailyIdFor(day: string, state: IdentityState) {
  const old = "daily-v1-"+day, fresh = "daily-v3-"+day;
  if (pilotDayIndex(day)<0) return old;
  const assigned = state.dailyAssignments?.[day];
  if (assigned===old || assigned===fresh) return assigned;
  const known = (id: string) => state.active===id || state.done.includes(id) ||
    Object.hasOwn(state.sessions,id) || Object.hasOwn(state.hints,id) ||
    Object.hasOwn(state.meta?.attempts ?? {},id);
  // A legacy identity that already exists always takes precedence over new scheduling.
  return known(old) ? old : known(fresh) ? fresh : fresh;
}
export function readDailyAssignments(value: unknown): Record<string,string> {
  if (!value || typeof value!=="object" || Array.isArray(value)) throw Error("Invalid daily assignments");
  const clean: Record<string,string> = {};
  for (const [day,id] of Object.entries(value)) {
    if (typeof id!=="string" || pilotDayIndex(day)<0 || dailyDay(id)!==day) throw Error("Invalid daily identity");
    clean[day]=id;
  }
  return clean;
}
