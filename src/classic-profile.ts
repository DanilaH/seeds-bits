import { WIDTH, addNumbers, occupied, pairs, removePair, type Connection } from "./core";

export type ClassicProof = ([number, number] | null)[];
export const CLASSIC_STYLES = ["open", "gaps", "stock"] as const;
export type ClassicStyle = (typeof CLASSIC_STYLES)[number];
export type ClassicMotif = { stage: "first-add" | "midpoint"; structure: string };

export const CLOSE_CLASSIC_MOTIF = 0.8;

/** Compare occupied slots in the same geometry, ignoring shared empty slots. */
export function classicMotifSimilarity(a: ClassicMotif, b: ClassicMotif) {
  if (a.stage !== b.stage || a.structure.length !== b.structure.length) return 0;
  let occupiedSlots = 0;
  let matchingSlots = 0;
  for (let i = 0; i < a.structure.length; i++) {
    const left = a.structure[i], right = b.structure[i];
    if (left === "0" && right === "0") continue;
    occupiedSlots++;
    if (left === right) matchingSlots++;
  }
  return matchingSlots / (occupiedSlots || 1);
}

export function crossesEmptyCell({ a, b, kind }: Connection) {
  if (kind === "reading") return b - a > 1;
  const dx = b % WIDTH - a % WIDTH;
  const dy = Math.floor(b / WIDTH) - Math.floor(a / WIDTH);
  return Math.max(Math.abs(dx), dy) > 1;
}

/** IDs travel with digits when a row disappears. Zero denotes an empty slot. */
export function remainingIds(ids: readonly number[], a: number, b: number) {
  const next = [...ids];
  next[a] = next[b] = 0;
  const compact: number[] = [];
  for (let i = 0; i < next.length; i += WIDTH) {
    const row = next.slice(i, i + WIDTH);
    if (row.some(Boolean)) compact.push(...row);
  }
  return compact;
}

function edgeKey(a: number, b: number, size: number) {
  return Math.min(a, b) * size + Math.max(a, b);
}

function edges(moves: readonly Connection[], ids: readonly number[], size: number) {
  return new Set(moves.map(({ a, b }) => edgeKey(ids[a], ids[b], size)));
}

export function measureClassic(initial: readonly number[], proof: ClassicProof) {
  let board = initial;
  let ids = initial.map((digit, i) => digit ? i + 1 : 0);
  let nextId = board.length + 1;
  // Large enough for every ID allocated by this particular witness.
  const keySize = board.length * (proof.length + 1) + 1;
  let legal = pairs(board);
  const midpointAfter = Math.ceil(occupied(initial) / 4);
  let midpoint: ClassicMotif | undefined;
  let firstAdd: ClassicMotif | undefined;
  const profile = {
    opening: legal.length,
    openingInFirstFourRows: legal.filter(({ b }) => b < 4 * WIDTH).length,
    removals: 0,
    additions: 0,
    firstAdd: null as number | null,
    gapMoves: 0,
    readingMoves: 0,
    diagonalMoves: 0,
    newPairs: 0,
    compressionChanges: 0,
    maxDigits: occupied(initial),
    peakLength: board.length,
  };
  for (const move of proof) {
    if (!move) {
      firstAdd ??= { stage: "first-add", structure: classicStructure(board) };
      board = addNumbers(board);
      ids.push(...Array.from({ length: board.length - ids.length }, () => nextId++));
      legal = pairs(board);
      profile.firstAdd ??= profile.removals;
      profile.additions++;
      profile.maxDigits = Math.max(profile.maxDigits, occupied(board));
      profile.peakLength = Math.max(profile.peakLength, board.length);
      continue;
    }
    const [a, b] = move;
    const path = legal.find(pair => pair.a === a && pair.b === b);
    if (!path) throw new Error("Invalid Classic witness");
    const before = edges(legal, ids, keySize);
    const previousBoard = board;
    const previousIds = ids;
    board = removePair(board, a, b);
    ids = remainingIds(ids, a, b);
    legal = pairs(board);
    const after = edges(legal, ids, keySize);
    for (const key of after) if (!before.has(key)) profile.newPairs++;
    if (board.length !== previousBoard.length && board.length) {
      const withHoles = [...previousBoard];
      withHoles[a] = withHoles[b] = 0;
      const beforeCompression = edges(pairs(withHoles), previousIds, keySize);
      for (const key of after) if (!beforeCompression.has(key)) profile.compressionChanges++;
      for (const key of beforeCompression) if (!after.has(key)) profile.compressionChanges++;
    }
    profile.removals++;
    if (profile.removals === midpointAfter && !firstAdd)
      midpoint = { stage: "midpoint", structure: classicStructure(board) };
    if (crossesEmptyCell(path)) profile.gapMoves++;
    if (path.kind === "reading") profile.readingMoves++;
    else if (a % WIDTH !== b % WIDTH && Math.floor(a / WIDTH) !== Math.floor(b / WIDTH))
      profile.diagonalMoves++;
  }
  if (board.length || occupied(board)) throw new Error("Incomplete Classic witness");
  const motif = firstAdd ?? midpoint ?? { stage: "midpoint", structure: classicStructure(initial) } as const;
  return { ...profile, motif };
}

/** Coordinate-preserving key, invariant under complement-preserving digit relabeling. */
export function classicStructure(board: readonly number[]) {
  const labels = new Map<number, number>();
  return board.map(digit => {
    if (digit === 0 || digit === 5) return digit;
    if (!labels.has(digit)) {
      const label = labels.size / 2 + 1;
      labels.set(digit, label);
      labels.set(10 - digit, 10 - label);
    }
    return labels.get(digit);
  }).join("");
}

export function openingEdges(board: readonly number[]) {
  return new Set(pairs(board).map(({ a, b }) => edgeKey(a, b, board.length)));
}

export function openingSimilarity(a: ReadonlySet<number>, b: ReadonlySet<number>) {
  let common = 0;
  for (const edge of a) if (b.has(edge)) common++;
  return common / (a.size + b.size - common || 1);
}

/** A failed policy remains unknown. Its bounds are diagnostics, not game rules. */
export function tryClassicOrder(
  initial: readonly number[], order: "first" | "last" | "random",
  maxAdds: number, limit: number, seed = 0,
) {
  let board = initial, removals = 0, additions = 0;
  const proof: ClassicProof = [];
  while (occupied(board) && proof.length < limit) {
    const legal = pairs(board);
    if (!legal.length) {
      if (additions === maxAdds) break;
      board = addNumbers(board);
      proof.push(null);
      additions++;
      continue;
    }
    let index = order === "last" ? legal.length - 1 : 0;
    if (order === "random") {
      seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
      index = seed % legal.length;
    }
    const { a, b } = legal[index];
    board = removePair(board, a, b);
    proof.push([a, b]);
    removals++;
  }
  return {
    outcome: occupied(board) ? "UNKNOWN" as const : "FOUND" as const,
    removals, additions, remaining: occupied(board), proof,
  };
}
