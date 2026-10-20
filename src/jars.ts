import type { Progress } from "./progress";
export type Jars = {
  version: 1;
  seeds: number;
  wins: number;
  attempt: string;
  highWater: number;
};
export function jars(p: Progress): Jars {
  const attempt = p.meta?.attempts.classic?.id ?? "legacy";
  return (p.jars ??= {
    version: 1,
    seeds: 0,
    wins: 0,
    attempt,
    highWater: p.sessions.classic?.current.moves ?? 0,
  });
}
/** A depth can earn only once in an attempt, including across undo, branches and reload. */
export function collectPair(p: Progress, moves: number): number {
  const j = jars(p),
    id = p.meta?.attempts.classic?.id ?? "legacy";
  if (j.attempt !== id) {
    j.attempt = id;
    j.highWater = 0;
  }
  if (moves <= j.highWater) return 0;
  j.highWater = moves;
  j.seeds += 2;
  return 2;
}
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
      : Math.min(2000, Math.round((120 * Math.pow(1.22, index - 2)) / 20) * 20);
}
export function jarState(seeds: number) {
  let index = 0,
    left = seeds;
  while (index < 18 && left >= jarCapacity(index)) {
    left -= jarCapacity(index++);
  }
  if (index === 18 && left >= 2000) {
    const full = Math.floor(left / 2000);
    index += full;
    left -= full * 2000;
  }
  const capacity = jarCapacity(index);
  return {
    index,
    filled: left,
    capacity,
    percent: Math.floor((left / capacity) * 100),
    name: jarNames[index % jarNames.length],
    color: jarColors[index % jarColors.length],
  };
}
