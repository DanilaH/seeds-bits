import { validDay, dayNumber } from "./calendar";
export const PILOT_START = "2026-12-01";
export const PILOT_END = "2026-12-24";
export const DAILY_V4_START = "2026-12-25";
export const DAILY_V4_BANK_END = "2027-12-24";
export const LEGACY_BOOK_TASKS = 2400;
export const PILOT_THEMES = ["links", "choice", "shift", "mix"] as const;
export type BookRevision = 1 | 4;
export function legacyBookNumber(id: string) {
  if (typeof id!=="string" || !/^book-v1-[1-9]\d*$/.test(id)) return 0;
  const n=Number(id.slice(8));return n<=LEGACY_BOOK_TASKS?n:0;
}
export function pilotBookId(id: string) {
  return /^book-v3-(links|choice|shift|mix)-([1-9]|1\d|2[0-4])$/.test(id);
}
export function pilotDayIndex(day: string) {
  return validDay(day) && day >= PILOT_START && day <= PILOT_END ? dayNumber(day)-dayNumber(PILOT_START) : -1;
}
export function dailyV4Index(day: string) {
  return validDay(day) && day>=DAILY_V4_START ? dayNumber(day)-dayNumber(DAILY_V4_START) : -1;
}
export function versionedDay(day: string) {
  return pilotDayIndex(day)>=0 || dailyV4Index(day)>=0;
}
export function dailyDay(id: string): string | undefined {
  if (typeof id !== "string" || !/^daily-v[134]-/.test(id)) return;
  const day = id.slice(9);
  if (!validDay(day) || day < "2025-01-01" ||
      (id.startsWith("daily-v3-") && pilotDayIndex(day)<0) ||
      (id.startsWith("daily-v4-") && dailyV4Index(day)<0)) return;
  return day;
}
export function validContentId(id: string) {
  return typeof id === "string" && (id === "classic" ||
    legacyBookNumber(id)>0 || pilotBookId(id) || dailyDay(id) !== undefined);
}
export function dailyDone(done: readonly string[], day: string) {
  return done.includes("daily-v1-"+day) ||
    (pilotDayIndex(day)>=0 && done.includes("daily-v3-"+day)) ||
    (dailyV4Index(day)>=0 && done.includes("daily-v4-"+day));
}
type IdentityState = {
  active?: string;
  done: readonly string[];
  sessions: Record<string, unknown>;
  hints?: Record<string, unknown>;
  meta?: { attempts: Record<string, unknown> };
  dailyAssignments?: Record<string, string>;
  bookRevisions?: Record<string,BookRevision>;
};
function knownIds(state: IdentityState) {
  return new Set([state.active ?? "",...state.done,...Object.keys(state.sessions ?? {}),...Object.keys(state.hints ?? {}),...Object.keys(state.meta?.attempts ?? {})]);
}
export function bookRevisionFor(id:string,state:IdentityState):BookRevision {
  const n=legacyBookNumber(id);
  if(n<=1)return 1; // fixed first-session lesson and guide
  const pinned=state.bookRevisions?.[id];
  if(pinned===1||pinned===4)return pinned;
  return knownIds(state).has(id)?1:4;
}
export function knownBookRevisions(state:IdentityState, requireExplicit=false) {
  const pins:Record<string,BookRevision>={...state.bookRevisions};
  for(const id of knownIds(state))if(legacyBookNumber(id)){
    if(requireExplicit && pins[id]===undefined)throw Error("Missing protected book revision: "+id);
    pins[id]??=1;
  }
  return pins;
}
export function readBookRevisions(value:unknown):Record<string,BookRevision> {
  if(!value||typeof value!=="object"||Array.isArray(value))throw Error("Invalid book revisions");
  const pins:Record<string,BookRevision>={};
  for(const [id,rev] of Object.entries(value)){
    if(!legacyBookNumber(id)||(rev!==1&&rev!==4)||(id==="book-v1-1"&&rev!==1))throw Error("Invalid book revision: "+id);
    pins[id]=rev;
  }
  return pins;
}
export function dailyIdFor(day: string, state: IdentityState) {
  const old = "daily-v1-"+day, pilot = "daily-v3-"+day, fresh="daily-v4-"+day;
  if (!versionedDay(day)) return old;
  const assigned = state.dailyAssignments?.[day];
  if (assigned && dailyDay(assigned)===day) return assigned;
  const ids=knownIds(state);
  // Preserve an older day's identity, including completed tasks and attempts.
  return ids.has(old)?old:pilotDayIndex(day)>=0?pilot:fresh;
}
export function knownDailyAssignments(state:IdentityState) {
  const assigned:Record<string,string>={...state.dailyAssignments};
  const days=new Set<string>();
  for(const id of knownIds(state)){const day=dailyDay(id);if(day&&versionedDay(day))days.add(day)}
  for(const day of days)assigned[day]??=dailyIdFor(day,state);
  return assigned;
}
export function readDailyAssignments(value: unknown): Record<string,string> {
  if (!value || typeof value!=="object" || Array.isArray(value)) throw Error("Invalid daily assignments");
  const clean: Record<string,string> = {};
  for (const [day,id] of Object.entries(value)) {
    if (typeof id!=="string" || !versionedDay(day) || dailyDay(id)!==day) throw Error("Invalid daily identity");
    clean[day]=id;
  }
  return clean;
}
