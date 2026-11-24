import { checkPair, occupied, pairs, removePair, WIDTH } from "../src/core.ts";
import {
  constructV5, dailyV5Size, packV5, survivingIndices, V5_STYLES, v5Random,
} from "../src/content-v5-generator.ts";
import { createAuthor } from "./author-content-v4.mjs";
import * as core from "../src/core.ts";

export const controls = [5, 20, 40, 65, 95];
export const groups = [
  { end: 10, limits: [[8, 26]], counts: [24, 0, 0] },
  { end: 25, limits: [[12, 26], [28, 36]], counts: [16, 8, 0] },
  { end: 50, limits: [[14, 26], [28, 54]], counts: [10, 14, 0] },
  { end: 75, limits: [[16, 26], [28, 54], [56, 72]], counts: [8, 10, 6] },
  { end: 100, limits: [[18, 26], [28, 54], [56, 108]], counts: [6, 10, 8] },
];
const v4 = createAuthor(core);
const RISK_BUDGET = 10_000;
const ALT_BUDGET = 64;
const ALT_LIMIT = 12;

export function slots(volume) {
  const group = groups.findIndex(g => volume <= g.end);
  const { limits } = groups[group];
  const rand = v5Random(`slots:${volume}`);
  const slots = [];
  for (let pos = 0; pos < 24; pos++) {
    const page = Math.floor(pos / 6), offset = pos % 6;
    const category = group === 0 ? 0 : group === 1 ? [0,0,1,0,0,1][offset] :
      group === 2 ? [0,1,1,0,1,page % 2 ? 0 : 1][offset] :
      group === 3 ? [0,1,2,1,page % 2 ? 1 : 2,0][offset] :
      [0,1,2,1,2,page % 2][offset];
    const [lo, hi] = limits[category];
    let n = lo + 2 * Math.floor(rand() * ((hi - lo) / 2 + 1));
    if (volume === 1 && pos === 0) n = 8;
    else if (volume === 65 && pos === 14) n = 72;
    else if (group === 4 && pos === 20) n = volume === 95 || volume === 100 ? 108 : 90 + 2 * ((volume * 3) % 10);
    else if (n === slots.at(-1)?.n) n = n === hi ? lo : n + 2;
    if (n === slots.at(-1)?.n) throw Error(`Repeated slot size ${volume}:${pos}`);
    const preferred = n <= 10 ? "relief" : n <= 26
      ? (n <= 18 && (pos + volume) % 3 === 0 ? "flow" : (pos + volume) % 2 ? "tactical" : "moderate")
      : ["reveal","compression","choice","distant","chain"][(volume + pos * 2) % 5];
    slots.push({ id: `book-v1-${(volume - 1) * 24 + pos + 1}`, n, category, preferred,
      style: V5_STYLES[(volume + pos) % 4], densityLevel: (page + offset * 2 + volume) % 5 });
  }
  return slots;
}

export function dateSlot(day, index) {
  const n = dailyV5Size(index);
  const preferred = n <= 26
    ? (n <= 18 && index % 3 === 0 ? "flow" : index % 2 ? "moderate" : "tactical")
    : ["reveal","compression","choice","distant","chain"][index % 5];
  return { id: `daily-v5-${day}`, n, category: n >= 38 ? 2 : n >= 28 ? 1 : 0,
    preferred, style: V5_STYLES[(index + Math.floor(index / 7)) % 4], densityLevel: index % 5 };
}

// Use stable original indices. The delimiter makes the key injective above index 63.
export const stablePair = (a, b) => a < b ? `${a}:${b}` : `${b}:${a}`;
const edgeMap = (board, ids) => new Map(pairs(board).map(p => [stablePair(ids[p.a], ids[p.b]), p]));
function take(board, ids, { a, b }) {
  const blank = board.slice();
  blank[a] = blank[b] = 0;
  return { blank, next: removePair(board, a, b), ids: survivingIndices(blank).map(i => ids[i]) };
}
const digits = b => b.join("");
const asPair = ({ a, b }) => [a, b];
const far = ({ a, b, kind }) => kind === "reading" ? Math.abs(a - b) > 1 :
  Math.max(Math.abs(a % WIDTH - b % WIDTH), Math.abs(Math.floor(a / WIDTH) - Math.floor(b / WIDTH))) > 1;

export function traceV5({ board, solution }) {
  let state = board, ids = board.map((_, i) => i), previous = new Map();
  const events = { reveal: 0, compression: 0, chain: 0, distant: 0, reading: 0 };
  const episodes = [], steps = [], zone = Math.ceil(board.length / WIDTH / 3);
  for (const [step, move] of solution.entries()) {
    const before = edgeMap(state, ids), delta = take(state, ids, move);
    const uncompressed = edgeMap(delta.blank, ids), after = edgeMap(delta.next, delta.ids);
    const newly = new Map();
    const chosen = stablePair(ids[move.a], ids[move.b]);
    if (previous.has(chosen)) events.chain++;
    events.reading += Number(move.kind === "reading");
    events.distant += Number(far(move));
    const removed = [ids[move.a], ids[move.b]];
    for (const [key, opened] of after) {
      if (before.has(key)) continue;
      const type = uncompressed.has(key) ? "reveal" : "compression";
      const stable = [delta.ids[opened.a], delta.ids[opened.b]];
      const interZone = Math.floor(stable[0] / WIDTH / zone) !== Math.floor(stable[1] / WIDTH / zone);
      newly.set(key, type);
      events[type]++;
      // Keep the first occurrence of each type and of a cross-zone occurrence.
      if (!episodes.some(e => e.type === type && e.interZone === interZone)) {
        episodes.push({ step, type, interZone, before: digits(state), uncompressed: digits(delta.blank),
          after: digits(delta.next), move: asPair(move), removed, opened: asPair(opened),
          stable, beforeIds: ids, afterIds: delta.ids });
      }
      if (step + 1 < solution.length &&
          stablePair(delta.ids[solution[step + 1].a], delta.ids[solution[step + 1].b]) === key &&
          !episodes.some(e => e.type === "chain" && e.interZone === interZone)) {
        episodes.push({ step, type: "chain", cause: type, interZone, before: digits(state),
          uncompressed: digits(delta.blank), after: digits(delta.next), move: asPair(move), removed,
          opened: asPair(opened), stable, beforeIds: ids, afterIds: delta.ids });
      }
    }
    steps.push({ state, ids, move, stable: removed, legal: [...before.values()] });
    previous = newly;
    ids = delta.ids;
    state = delta.next;
  }
  if (state.length) throw Error("Witness did not empty the board");
  return { events, episodes, steps };
}

function fromWitness(state, ids, suffix) {
  const witness = [];
  for (const { stable } of suffix) {
    const a = ids.indexOf(stable[0]), b = ids.indexOf(stable[1]);
    const match = checkPair(state, a, b);
    if (!match.ok) continue;
    witness.push(match.path);
    const delta = take(state, ids, match.path);
    state = delta.next;
    ids = delta.ids;
  }
  return { witness, state };
}

function searchWin(start, budget, memo) {
  let used = 0;
  function visit(board) {
    if (!board.length) return [];
    const key = digits(board);
    if (memo.has(key)) return memo.get(key);
    if (used >= budget) return undefined;
    used++;
    let unknown = false;
    for (const move of pairs(board)) {
      const result = visit(removePair(board, move.a, move.b));
      if (result) {
        const witness = [...asPair(move), ...result];
        memo.set(key, witness);
        return witness;
      }
      if (result === undefined) unknown = true;
    }
    if (!unknown) memo.set(key, null);
    return unknown ? undefined : null;
  }
  return { witness: visit(start), used };
}

export function sampleV5(trace, smallRisk) {
  const { steps } = trace;
  const at = smallRisk
    ? [...new Set([0, smallRisk.riskStep].filter(i => i >= 0))]
    : [...new Set([0, .25, .50, .75].map(p => Math.floor(steps.length * p)))];
  const memo = new Map();
  let suffix = [];
  for (let i = steps.length - 1; i >= 0; i--) {
    suffix = [...asPair(steps[i].move), ...suffix];
    memo.set(digits(steps[i].state), suffix);
  }
  return at.map(index => {
    const step = steps[index], { state, ids, move } = step;
    const same = (q, p) => q.a === p.a && q.b === p.b;
    const competes = q => q.a === move.a || q.b === move.a || q.a === move.b || q.b === move.b;
    const all = step.legal.filter(q => !same(q, move)).sort((a,b) => Number(competes(b)) - Number(competes(a)));
    const limit = smallRisk ? all.length : ALT_LIMIT;
    const budget = smallRisk ? RISK_BUDGET : ALT_BUDGET;
    const alternatives = all.slice(0, limit).map(q => {
      const delta = take(state, ids, q);
      const patched = fromWitness(delta.next, delta.ids, steps.slice(index + 1));
      if (!patched.state.length)
        return { pair: asPair(q), competes: competes(q), result: "FOUND", budget, used: 0,
          proof: patched.witness.flatMap(asPair) };
      // Exhaustion can only certify UNSOLVABLE when starting at the actual successor.
      const outcome = searchWin(delta.next, budget, memo);
      if (outcome.witness === undefined && patched.witness.length) {
        const finish = searchWin(patched.state, budget - outcome.used, memo);
        if (finish.witness)
          return { pair: asPair(q), competes: competes(q), result: "FOUND", budget,
            used: outcome.used + finish.used, proof: [...patched.witness.flatMap(asPair), ...finish.witness] };
      }
      return { pair: asPair(q), competes: competes(q), budget, used: outcome.used,
        result: outcome.witness ? "FOUND" : outcome.witness === null ? "NO_WIN" : "UNKNOWN",
        proof: outcome.witness ?? undefined };
    });
    return { index, board: digits(state), chosen: asPair(move), legal: step.legal.length,
      alternatives, notChecked: all.slice(limit).map(asPair), budget };
  });
}

function pad(board) {
  return [...board, ...Array((WIDTH - board.length % WIDTH) % WIDTH).fill(0)];
}
export const canonical = b => v4.canon(pad(b));
export const mask = b => v4.mask(pad(b));

function crop(board) {
  const cells = board.flatMap((value, i) => value ? [[Math.floor(i / WIDTH), i % WIDTH]] : []);
  const top = Math.min(...cells.map(([r]) => r)), bottom = Math.max(...cells.map(([r]) => r));
  const left = Math.min(...cells.map(([,c]) => c)), right = Math.max(...cells.map(([,c]) => c));
  return Array.from({length: bottom - top + 1}, (_, i) => board.slice((top+i)*WIDTH+left,(top+i)*WIDTH+right+1));
}
export function shapeKey(board) {
  const rect = crop(pad(board));
  const forms = [rect, [...rect].reverse(), rect.map(row=>[...row].reverse()), [...rect].reverse().map(row=>[...row].reverse())];
  return forms.map(rows=>rows.map(row=>row.map(Number).map(n=>n?1:0).join("")).join("/")).sort()[0];
}

export function geometry(board) {
  const rowCounts = [], cols = Array(WIDTH).fill(0);
  let edge = 0, links = 0;
  for (let i = 0; i < board.length; i += WIDTH) rowCounts.push(occupied(board.slice(i, i + WIDTH)));
  const rows = rowCounts.length, n = occupied(board);
  for (const [i, value] of board.entries()) if (value) {
    const col = i % WIDTH;
    cols[col]++;
    edge += Number(col < 2 || col >= WIDTH - 2);
    links += Number(col > 0 && Boolean(board[i - 1])) + Number(Boolean(board[i - WIDTH]));
  }
  const density = n / (rows * WIDTH);
  const dispersion = Math.sqrt(rowCounts.reduce((s,c)=>s+(c-n/rows)**2,0)/rows);
  return { n, rows, cells: board.length, density, rowCounts, cols, edge: edge/n, dispersion, adjacency: links/n,
    observed: [Math.floor(density * 6), Math.floor(edge/n * 5), Math.floor(dispersion)].join("/") };
}

export function authorV5(slot, exclusion) {
  const rand = v5Random(slot.id);
  const large = slot.n >= 56;
  const strict = slot.n >= 12 && slot.n <= 26;
  const counts = { construction: 0, duplicate: 0, evidence: 0, risk: 0 };
  for (let attempt = 0; attempt < 540; attempt++) {
    const extra = attempt < 18 ? slot.densityLevel : (slot.densityLevel + attempt) % 5;
    const rows = Math.min(slot.n / 2, Math.ceil(slot.n / WIDTH) + 1 + extra);
    const style = attempt < 42 ? slot.style : V5_STYLES[(V5_STYLES.indexOf(slot.style) + attempt) % 4];
    const field = constructV5(slot.n, rows, style, rand);
    if (!field || new Set(field.board.filter(Boolean)).size < Math.min(4, slot.n/2)) {
      counts.construction++;
      continue;
    }
    const key = canonical(field.board), pattern = mask(field.board), shape = large && shapeKey(field.board);
    if (exclusion.keys.has(key) || exclusion.masks.has(pattern) || (shape && exclusion.shapes.has(shape))) {
      counts.duplicate++;
      continue;
    }
    let verification, exact, profile;
    if (strict) {
      const riskOrder = attempt < 28 ? [slot.preferred] : [...new Set([slot.preferred,"moderate","tactical","flow"])];
      for (const type of riskOrder) {
        exact = v4.classify(field.board, field.solution, type, "mix", RISK_BUDGET);
        if (exact) {
          profile = type;
          break;
        }
      }
      if (!exact) {
        counts.risk++;
        continue;
      }
      verification = exact.verification;
    } else profile = slot.n <= 10 ? "relief" : "sampled";
    const trace = traceV5(field);
    if (large && (!trace.episodes.some(e=>e.interZone) || new Set(trace.episodes.map(e=>e.type)).size < 2
        || trace.events.distant === 0 || repeatMotifs(field.board))) {
      counts.evidence++;
      continue;
    }
    const lead = slot.preferred === "choice" ? "choice" : slot.preferred;
    if (!strict && attempt < 8 && ["reveal","compression","chain","distant"].includes(lead) && !trace.events[lead]) {
      counts.evidence++;
      continue;
    }
    const checkpoints = sampleV5(trace, exact);
    const risk = riskSummary(checkpoints);
    const competition = checkpoints.some(c => c.alternatives.some(a => a.competes && a.result === "NO_WIN"));
    if (!verification) verification = risk.found + risk.losing + risk.unknown ? "SAMPLED" : "WITNESS_ONLY";
    // The strictly proven profile and its losing step are distinct from the samples.
    exclusion.keys.add(key);
    exclusion.masks.add(pattern);
    exclusion.shapes.add(shape || shapeKey(field.board));
    const leading = competition && lead === "choice" ? "competition" :
      (trace.events[lead] ? lead : Object.entries(trace.events).sort((a,b)=>b[1]-a[1])[0][0]);
    return { row: packV5(field), passport: { id: slot.id, requested: slot, style, profile, verification,
      exact, geometry: geometry(field.board), opening: trace.steps[0].legal.length, depth: field.solution.length,
      events: trace.events, leading, competition, risk, attempts: attempt + 1, rejected: counts },
      proof: { id: slot.id, checkpoints, episodes: large ? trace.episodes : [] } };
  }
  throw Error(`V5 slot ${slot.id} not filled: ${JSON.stringify({slot, counts})}`);
}

function repeatMotifs(board) {
  const windows = [];
  for (let pos = 0; pos + 27 <= board.length; pos += WIDTH) {
    const block = board.slice(pos, pos+27);
    if (occupied(block) >= 13) windows.push([pos, shapeKey(block)]);
  }
  return windows.some(([pos,k], i) => windows.slice(i+1).some(([other,l]) => other-pos>=27 && k===l));
}

export function riskSummary(checkpoints) {
  const results = checkpoints.flatMap(c => c.alternatives);
  return {
    found: results.filter(a => a.result === "FOUND").length,
    losing: results.filter(a => a.result === "NO_WIN").length,
    unknown: results.filter(a => a.result === "UNKNOWN").length,
    notChecked: checkpoints.reduce((n,c)=>n+c.notChecked.length,0),
  };
}
