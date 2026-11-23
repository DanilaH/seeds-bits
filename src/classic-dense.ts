import { WIDTH, addNumbers, pairs, removePair } from "./core";
import { crossesEmptyCell, remainingIds, type ClassicProof, type ClassicStyle } from "./classic-profile";

// Pair-free prefixes stranding more digits earlier. Moves are in the geometry
// after Add, including empty slots at the end of the protected row.
const stockKernels: { digits: string; afterAdd: ClassicProof }[] = [
  { digits: "453292148929453", afterAdd: [[6,24],[7,25],[5,8],[4,9],[0,18],[3,10],[1,19],[14,20],[11,29],[23,26],[22,27],[13,31],[21,28],[12,21],[2,14]] },
  { digits: "656543213238921656945", afterAdd: [[13,33],[3,43],[2,4],[12,14],[5,32],[15,31],[7,39],[19,27],[20,28],[10,37],[9,11],[36,38],[18,45],[17,20],[8,26],[16,21],[6,22],[16,23],[15,17],[0,10],[1,11]] },
  { digits: "892417898565786545932953183", afterAdd: [[18,28],[20,29],[10,30],[0,40],[9,11],[1,21],[12,39],[8,13],[22,38],[2,47],[4,31],[19,23],[24,34],[25,33],[3,43],[15,42],[14,16],[5,32],[37,41],[17,49],[6,26],[7,39],[18,26],[8,26],[10,14],[9,15],[0,16]] },
  { digits: "742151532157424895689593532534768", afterAdd: [[23,43],[24,42],[15,51],[6,60],[26,44],[17,53],[8,62],[28,36],[29,37],[32,38],[18,48],[22,52],[25,61],[21,27],[41,45],[14,50],[40,46],[19,55],[9,39],[16,20],[11,29],[12,22],[13,31],[4,36],[3,5],[10,30],[1,31],[7,23],[20,22],[0,30],[12,28],[9,20],[2,14]] },
];

/**
 * Choose a removal route on occupied geometry, then assign compatible digits
 * to its saved endpoints. The protected row starts at the left edge and
 * survives at its original width, so Add copies it directly beneath itself.
 */
export function constructDense(
  size: 45 | 81, style: ClassicStyle, nextInt: (max: number) => number,
) {
  const board = Array<number>(size).fill(0);
  const kernel = style === "stock" ? stockKernels[size === 45 ? nextInt(2) : 1 + nextInt(3)] : undefined;
  const reserved = kernel?.digits.length ?? (style === "open" ? 1 : 5);
  const protectedId = (id: number) => id > 0 && id <= reserved;
  let shapes = Array<number>(size).fill(1);
  let ids = shapes.map((_, index) => index + 1);
  let left = size;
  const proof: ClassicProof = [];
  const classes = [1, 2, 3, 4];
  for (let index = classes.length - 1; index > 0; index--) {
    const target = nextInt(index + 1);
    [classes[index], classes[target]] = [classes[target], classes[index]];
  }
  // Relabel complement classes consistently, keeping both topology and witness.
  const values = [0, ...classes.map(n => nextInt(2) ? n : 10 - n), 5];
  for (let n = 6; n <= 9; n++) values[n] = 10 - values[10 - n];
  for (let i = 0; i < reserved; i++) board[i] = values[kernel ? Number(kernel.digits[i]) : i + 1];
  while (left > reserved) {
    const choices = pairs(shapes).filter(({ a, b }) => !protectedId(ids[a]) && !protectedId(ids[b]));
    if (!choices.length) return;
    const preferred = choices.filter(pair => {
      switch (style) {
        case "gaps": return crossesEmptyCell(pair);
        case "stock": return pair.b >= shapes.length - 2 * WIDTH;
        case "open": return !crossesEmptyCell(pair) && pair.b - pair.a >= WIDTH - 1;
      }
    });
    const options = preferred.length && nextInt(5) !== 0 ? preferred : choices;
    const { a, b } = options[nextInt(options.length)];
    board[ids[a] - 1] = 1 + nextInt(9);
    board[ids[b] - 1] = nextInt(2) ? board[ids[a] - 1] : 10 - board[ids[a] - 1];
    proof.push([a, b]);
    shapes = removePair(shapes, a, b);
    ids = remainingIds(ids, a, b);
    left -= 2;
  }
  proof.push(null);
  if (kernel) proof.push(...kernel.afterAdd);
  else for (let i = 0; i < reserved; i++) proof.push([i, i + WIDTH]);
  return { board, proof };
}

/** Certified budget fallback: reserve the last digit and clear pair blocks in reading order. */
export function denseFallback(size: 45 | 81, nextInt: (max: number) => number) {
  // Blocks always include every pair class, even on an unlucky draw.
  const blocks = Array.from({ length: (size - 1) / 2 }, (_, i) => {
    const value = i < 9 ? i + 1 : nextInt(9) + 1;
    return [value, nextInt(2) ? value : 10 - value];
  });
  return { blocks, last: nextInt(9) + 1 };
}

export function clearInReadingOrder(initial: readonly number[], addLast = false) {
  const proof: ClassicProof = [];
  let board = initial;
  while (board.length) {
    const a = board.findIndex(Boolean);
    const b = board.findIndex((digit, index) => index > a && digit > 0);
    if (b === -1 && addLast) {
      board = addNumbers(board);
      proof.push(null);
      addLast = false;
    } else {
      board = removePair(board, a, b);
      proof.push([a, b]);
    }
  }
  return proof;
}
