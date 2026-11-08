import type { Progress } from "./progress";
export type Jars = {
  version: 2;
  /** Lifetime earned seeds, retained verbatim on migration. */
  seeds: number;
  /** Position on the new capacity curve; not another spendable currency. */
  meter: number;
  wins: number;
  attempt: string;
  highWater: number;
};
export const jarNames = [
  "Льняная",
  "Медовая",
  "Хвойная",
  "Морская",
  "Сливовая",
  "Ночная",
];
export const jarColors = [
  "#b58b51",
  "#c79539",
  "#4e8269",
  "#4b8794",
  "#97729a",
  "#6c789d",
];
export function jarCapacity(index: number) {
  return index === 0
    ? 24
    : index === 1
      ? 60
      : Math.min(480, 100 + (index - 2) * 40);
}
export function legacyJarCapacity(index: number) {
  return index === 0
    ? 24
    : index === 1
      ? 60
      : Math.min(2000, Math.round((120 * Math.pow(1.22, index - 2)) / 20) * 20);
}
function state(
  seeds: number,
  capacityAt: (i: number) => number,
  flatAt: number,
) {
  let index = 0,
    left = Math.max(0, seeds);
  while (index < flatAt && left >= capacityAt(index))
    left -= capacityAt(index++);
  const cap = capacityAt(index);
  const full = Math.floor(left / cap);
  index += full;
  left -= full * cap;
  return {
    index,
    filled: left,
    capacity: cap,
    percent: Math.floor((left / cap) * 100),
    name: jarNames[index % 6],
    color: jarColors[index % 6],
  };
}
export function jarState(seeds: number) {
  return state(seeds, jarCapacity, 12);
}
export function migrateJars(
  old: Omit<Jars, "version" | "meter"> & { version: 1 },
): Jars {
  const previous = state(old.seeds, legacyJarCapacity, 18);
  let meter = 0;
  for (let i = 0; i < Math.min(previous.index, 12); i++)
    meter += jarCapacity(i);
  if (previous.index > 12) meter += (previous.index - 12) * 480;
  meter += Math.min(
    jarCapacity(previous.index) - 1,
    Math.ceil(
      (previous.filled / previous.capacity) * jarCapacity(previous.index),
    ),
  );
  return { ...old, version: 2, meter };
}
export function jars(p: Progress): Jars {
  return (p.jars ??= {
    version: 2,
    seeds: 0,
    meter: 0,
    wins: 0,
    attempt: p.meta?.attempts.classic?.id ?? "legacy",
    highWater: p.sessions.classic?.current.moves ?? 0,
  });
}
export function addSeeds(p: Progress, n: number) {
  const j = jars(p);
  j.seeds += n;
  j.meter += n;
}
/** Undo/rebranch cannot farm a previously reached depth. */
export function collectPair(p: Progress, moves: number): number {
  const j = jars(p),
    id = p.meta?.attempts.classic?.id ?? "legacy";
  if (j.attempt !== id) {
    j.attempt = id;
    j.highWater = 0;
  }
  if (moves <= j.highWater) return 0;
  j.highWater = moves;
  addSeeds(p, 2);
  return 2;
}
/** First unique task only; long boards receive a bounded contribution. */
export function taskSeeds(pairCount: number) {
  return Math.min(24, Math.max(4, Math.ceil(pairCount / 4) * 2));
}
