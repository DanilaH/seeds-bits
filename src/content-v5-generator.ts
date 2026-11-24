import { checkPair, occupied, removePair, pairs, WIDTH, MAX_CELLS, type Connection } from "./core";

export const V5_SEED = "seeds-content-v5-20261124";
export const V5_STYLES = ["uniform", "clusters", "bands", "edges"] as const;
export type V5Style = typeof V5_STYLES[number];
export type V5Field = { board: number[]; solution: Connection[] };
export type V5Row = readonly [digits: string, proof: readonly number[]];

export function v5Random(seed: string) {
  let state = 2166136261;
  for (const c of `${V5_SEED}:${seed}`) state = Math.imul(state ^ c.charCodeAt(0), 16777619);
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A fixed-width row disappears only when its last occupied cell disappears. */
export function survivingIndices(board: readonly number[]) {
  const indices: number[] = [];
  for (let start = 0; start < board.length; start += WIDTH) {
    const end = Math.min(start + WIDTH, board.length);
    if (board.slice(start, end).some(Boolean))
      for (let i = start; i < end; i++) indices.push(i);
  }
  return indices;
}

export function packV5(field: V5Field): V5Row {
  return [field.board.join(""), field.solution.flatMap(({ a, b }) => [a, b])];
}

export function replayV5([digits, proof]: V5Row): V5Field {
  if (digits.length > MAX_CELLS || !/^[0-9]+$/.test(digits) || proof.length % 2) throw Error("Invalid v5 content record");
  const board = Array.from(digits, Number);
  let current = board;
  const solution: Connection[] = [];
  for (let i = 0; i < proof.length; i += 2) {
    const match = checkPair(current, proof[i], proof[i + 1]);
    if (!match.ok) throw Error(`Invalid v5 pair at step ${i / 2}`);
    solution.push(match.path);
    current = removePair(current, match.path.a, match.path.b);
  }
  if (!solution.length || occupied(current)) throw Error("Incomplete v5 solution");
  return { board, solution };
}

function replayInsertions(board: number[], inserted: [number, number][]): V5Field {
  let ids = board.map((_, index) => index), current = board;
  const solution: Connection[] = [];
  for (let step = inserted.length - 1; step >= 0; step--) {
    const [x, y] = inserted[step];
    const first = ids.indexOf(x), second = ids.indexOf(y);
    const a = Math.min(first, second), b = Math.max(first, second);
    const check = checkPair(current, a, b);
    if (!check.ok) throw Error("Invalid v5 reverse construction");
    solution.push(check.path);
    const blank = current.slice();
    blank[a] = blank[b] = 0;
    ids = survivingIndices(blank).map(i => ids[i]);
    current = removePair(current, a, b);
  }
  if (current.length) throw Error("Incomplete v5 reverse construction");
  return { board, solution };
}

/** Insert pairs against the same row compaction and connection rules used in play. */
export function constructV5(n: number, rows: number, style: V5Style, rand: () => number): V5Field | undefined {
  const board = Array<number>(rows * WIDTH).fill(0);
  const counts = Array<number>(rows).fill(0);
  const groupUses = Array<number>(5).fill(0);
  const order: [number, number][] = [];
  const int = (max: number) => Math.floor(rand() * max);
  const centers = [int(board.length), int(board.length), int(board.length)];
  const rowWeights = counts.map(() => rand() < .45 ? 4 : .26);
  const columnWeights = Array.from({ length: WIDTH }, () => rand() < .45 ? 3 : .55);
  const rotated = rand() < .5;
  const weights = board.map((_, index) => {
    const row = Math.floor(index / WIDTH), col = index % WIDTH;
    switch (style) {
      case "clusters": return .12 + 4 / (1 + Math.min(...centers.map(c =>
        Math.abs(row - Math.floor(c / WIDTH)) + Math.abs(col - c % WIDTH))));
      case "bands": return rotated ? rowWeights[row] * columnWeights[col] : rowWeights[row] + columnWeights[col] * .1;
      case "edges": return col < 2 || col >= WIDTH - 2 || row === 0 || row === rows - 1 ? 3.8 : .35;
      default: return 1;
    }
  });
  const pick = (vacant: number[]) => {
    let ticket = rand() * vacant.reduce((sum, i) => sum + weights[i], 0);
    for (const i of vacant) {
      ticket -= weights[i];
      if (ticket < 0) return i;
    }
    return vacant.at(-1)!;
  };
  const rowOf = (i: number) => Math.floor(i / WIDTH);
  let filledRows = 0;
  const legal = (a: number, b: number) => {
    if (a === b) return false;
    board[a] = board[b] = 5;
    let found;
    if (filledRows === rows) found = checkPair(board, a, b).ok;
    else {
      const indices = survivingIndices(board);
      found = checkPair(indices.map(i => board[i]), indices.indexOf(a), indices.indexOf(b)).ok;
    }
    board[a] = board[b] = 0;
    return found;
  };
  for (let step = 0; step < n / 2; step++) {
    const vacant = board.flatMap((value, i) => value ? [] : [i]);
    const needRows = rows - filledRows;
    const unused = needRows ? vacant.filter(i => !counts[rowOf(i)]) : [];
    const requireUnused = needRows >= n / 2 - step && unused.length > 0;
    const heads = requireUnused || (unused.length && rand() < .52) ? unused : vacant;
    let pair: [number, number] | undefined;
    for (let t = 0; t < 52; t++) {
      const a = pick(heads), b = pick(vacant);
      if (legal(a, b)) {
        pair = [a, b];
        break;
      }
    }
    if (!pair) {
      // deterministic exhaustive tail; filling a required row takes priority
      const choices = requireUnused ? [heads] : [heads, vacant];
      search: for (const first of choices) for (const a of first) for (const b of vacant) {
        if (legal(a, b)) {
          pair = [a, b];
          break search;
        }
      }
    }
    if (!pair) return;
    const [a, b] = pair;
    const least = Math.min(...groupUses);
    const families = groupUses.flatMap((count, i) => count <= least + (rand() < .19 ? 1 : 0) ? [i + 1] : []);
    const digit = families[int(families.length)];
    groupUses[digit - 1]++;
    board[a] = rand() < .5 ? digit : 10 - digit;
    board[b] = rand() < .55 ? 10 - board[a] : board[a];
    for (const i of pair) if (counts[rowOf(i)]++ === 0) filledRows++;
    order.push(pair);
  }
  if (filledRows === rows) return replayInsertions(board, order);
}

/** Fixed seven-day rhythm, with the 365th day a regular day. */
export function dailyV5Size(index: number) {
  const week = Math.floor(index / 7), day = index % 7;
  const waves = [[12, 24, 16, 32, 20, 28], [14, 26, 18, 34, 22, 30], [16, 28, 12, 36, 24, 26]];
  return day === 6 ? 38 + 2 * ((week * 5) % 9) : waves[week % waves.length][day];
}

function adjoiningFallback(n: number, rows: number, rand: () => number): V5Field {
  const size = Math.max(rows, Math.ceil(n / 8));
  const board = Array<number>(size * WIDTH).fill(0);
  const order: [number, number][] = [];
  let left = n / 2;
  for (let row = 0; row < size; row++) {
    const count = Math.max(1, Math.min(4, Math.ceil(left / (size - row))));
    const slots = rand() < .5 ? [0, 2, 4, 6] : [1, 3, 5, 7];
    for (let i = 0; i < count; i++) {
      const col = slots.splice(Math.floor(rand() * slots.length), 1)[0];
      const a = row * WIDTH + col, b = a + 1;
      board[a] = 1 + Math.floor(rand() * 9);
      board[b] = rand() < .5 ? board[a] : 10 - board[a];
      order.push([a, b]);
    }
    left -= count;
  }
  if (left) throw Error("Invalid v5 fallback capacity");
  return replayInsertions(board, order);
}

/** Frozen v5 date continuation. Its input is the calendar date, never device time or storage. */
export function continueV5Daily(day: string, index: number): V5Field & { fallback: boolean } {
  const n = dailyV5Size(index), rand = v5Random(`date:${day}`);
  const baseRows = Math.ceil(n / WIDTH) + 1 + index % 3;
  const style = V5_STYLES[index % V5_STYLES.length];
  const motif = index % 3;
  let best: V5Field | undefined, bestScore = -Infinity;
  for (let attempt = 0; attempt < 4; attempt++) {
    const field = constructV5(n, Math.min(n / 2, baseRows + attempt % 2), style, rand);
    if (!field) continue;
    const first = pairs(field.board).length;
    const reading = field.solution.filter(p => p.kind === "reading" && p.b - p.a > 1).length;
    const distant = field.solution.filter(p => p.kind === "straight" && p.b - p.a > 2).length;
    const score = motif === 0 ? distant + first * .2 : motif === 1 ? reading * 1.5 + distant : first - distant * .2;
    if (score > bestScore) {
      best = field;
      bestScore = score;
    }
  }
  const field = best ?? adjoiningFallback(n, Math.min(n / 2, baseRows), rand);
  return { ...field, fallback: !best };
}
