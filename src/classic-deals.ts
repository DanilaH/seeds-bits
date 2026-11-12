import catalog from "./classic-catalog.json" with { type: "json" };
import { classic, newSession, type Session } from "./core";

// Append a new version rather than reordering these IDs: saves refer to them.
export const classicCatalog = catalog;
export type ClassicDeals = {
  version: 1;
  seed: number;
  bag: number[];
  recent: number[];
  current?: { id: number; attempt: string };
};
const validId = (n: unknown): n is number =>
  Number.isInteger(n) && Number(n) >= 0 && Number(n) < catalog.length;
export function readClassicDeals(value: unknown): ClassicDeals | undefined {
  const v = value as ClassicDeals | undefined;
  if (
    !v ||
    v.version !== 1 ||
    !Number.isInteger(v.seed) ||
    v.seed < 0 ||
    v.seed > 0xffffffff ||
    !Array.isArray(v.bag) ||
    v.bag.length > catalog.length ||
    !v.bag.every(validId) ||
    new Set(v.bag).size !== v.bag.length ||
    !Array.isArray(v.recent) ||
    v.recent.length > 8 ||
    !v.recent.every(validId) ||
    new Set(v.recent).size !== v.recent.length ||
    (v.current !== undefined &&
      (!validId(v.current?.id) ||
        typeof v.current.attempt !== "string" ||
        !v.current.attempt.length ||
        v.current.attempt.length > 100))
  )
    return;
  return {
    version: 1,
    seed: v.seed,
    bag: [...v.bag],
    recent: [...v.recent],
    ...(v.current ? { current: { ...v.current } } : {}),
  };
}
export function newClassicDeals(
  seed = crypto.getRandomValues(new Uint32Array(1))[0],
): ClassicDeals {
  return { version: 1, seed: seed >>> 0, bag: [], recent: [] };
}
function random(state: ClassicDeals) {
  state.seed = (state.seed + 0x6d2b79f5) >>> 0;
  let t = Math.imul(state.seed ^ (state.seed >>> 15), 1 | state.seed);
  t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function shuffle<T>(items: T[], state: ClassicDeals) {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(random(state) * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}
function refill(state: ClassicDeals) {
  const families = [...new Set(catalog.map((entry) => entry.family))];
  const groups = new Map(
    families.map((family) => {
      const ids = shuffle(
        catalog.flatMap((entry, id) => (entry.family === family ? [id] : [])),
        state,
      );
      // Recent fields wait at the end of their family on the next cycle.
      return [
        family,
        [
          ...ids.filter((id) => !state.recent.includes(id)),
          ...ids.filter((id) => state.recent.includes(id)),
        ],
      ];
    }),
  );
  let previous = state.recent.length
    ? catalog[state.recent.at(-1)!].family
    : undefined;
  while ([...groups.values()].some((ids) => ids.length)) {
    const order = shuffle([...families], state);
    // Keep the first new field small; alternate families thereafter.
    const first =
      previous === undefined
        ? order.indexOf("compact")
        : order.findIndex((family) => family !== previous);
    if (first > 0) [order[0], order[first]] = [order[first], order[0]];
    for (const family of order) {
      const id = groups.get(family)!.shift();
      if (id !== undefined) {
        state.bag.push(id);
        previous = family;
      }
    }
  }
}
/** Mutates only a candidate snapshot. Publish it after the save succeeds. */
export function takeClassicDeal(state: ClassicDeals, attempt: string): Session {
  if (!state.bag.length) refill(state);
  const id = state.bag.shift()!;
  state.recent = [...state.recent, id].slice(-8);
  state.current = { id, attempt };
  const game = newSession();
  game.current.board = catalog[id].board.split("").map(Number);
  return game;
}
export function restartClassic(
  game: Session,
  state: ClassicDeals | undefined,
  attempt: string,
): Session {
  const result = newSession();
  result.current.board =
    state?.current?.attempt === attempt
      ? catalog[state.current.id].board.split("").map(Number)
      : [
          ...(game.history[0]?.board ??
            (!game.current.moves && !game.current.additions
              ? game.current.board
              : classic())),
        ];
  return result;
}
