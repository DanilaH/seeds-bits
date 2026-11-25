// Node 24+. Run from the project root. --author writes only the opening overlay.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { registerHooks } from "node:module";

registerHooks({ resolve(specifier, context, next) {
  try { return next(specifier, context); }
  catch (error) {
    if (error.code !== "ERR_MODULE_NOT_FOUND" || !specifier.startsWith(".")) throw error;
    return next(specifier + ".ts", context);
  }
}});

const { pairs, occupied, removePair, WIDTH } = await import("../src/core.ts");
const { constructV5, packV5, replayV5, v5Random, V5_STYLES } = await import("../src/content-v5-generator.ts");
const { canonical, mask, shapeKey, geometry, traceV5 } = await import("./author-content-v5.mjs");
const read = file => JSON.parse(readFileSync("src/" + file + ".json", "utf8"));
const overlayPath = "src/notebook-opening-v6.json";
const legacy = read("notebook");
const v5 = read("content-v5-books-1");
const baseline = [legacy[0], ...v5.slice(1, 12).map(replayV5)];
const plans = [
  [8,"FLOW"], [10,"FLOW"], [12,"FLOW"], [14,"FLOW"],
  [16,"MODERATE"], [12,"FLOW"], [16,"FLOW"], [18,"MODERATE"],
  [14,"FLOW"], [20,"MODERATE"], [16,"FLOW"], [22,"TACTICAL"],
];

function exact(field) {
  const states = new Map();
  const key = board => board.join("");
  const visit = board => {
    const k = key(board);
    if (states.has(k)) return states.get(k);
    assert(states.size < 100000, "Exhaustive verification budget exceeded");
    const state = { board, win: !occupied(board), withoutEdge: !occupied(board), edges: [] };
    states.set(k,state);
    for (const pair of pairs(board)) {
      const child = visit(removePair(board, pair.a, pair.b));
      state.edges.push({ pair, child });
      state.win ||= child.win;
      state.withoutEdge ||= pair.kind !== "reading" && child.withoutEdge;
    }
    return state;
  };
  const root = visit(field.board);
  assert(root.win, "Missing complete solution");
  const move = ({ a,b }) => [a,b];
  const losing = root.edges.filter(({ child }) => !child.win).map(({ pair }) => move(pair));
  const safe = root.edges.length - losing.length;
  const laterRisk = [...states.values()].find(state => state !== root && state.win &&
    state.edges.some(({ child }) => !child.win));
  const deadStates = [...states.values()].filter(state => !state.win).length;
  const terminalDead = [...states.values()].filter(state => !state.win && !state.edges.length).length;
  const profile = !deadStates ? "FLOW" : losing.length ? "TACTICAL" : laterRisk ? "MODERATE" : "OTHER";
  const mandatoryState = [...states.values()].find(state => state.win && state.edges.length &&
    state.edges.every(({ pair }) => pair.kind === "reading"));
  const findRoute = (state, target) => {
    if (state === target) return [];
    for (const { pair, child } of state.edges) {
      const path = findRoute(child, target);
      if (path) return [move(pair), ...path];
    }
  };
  return { profile, states: states.size, deadStates, terminalDead, opening: {
    legal: root.edges.length, safe, dead: losing.length, unknown: 0, losing,
  }, laterRisk: laterRisk && { board: key(laterRisk.board), path: findRoute(root,laterRisk),
    pair: move(laterRisk.edges.find(({ child }) => !child.win).pair) },
  edgeObligatory: !root.withoutEdge,
  forcedEdge: mandatoryState && { board: key(mandatoryState.board), prefix: findRoute(root,mandatoryState),
    choices: mandatoryState.edges.map(({ pair }) => move(pair)) } };
}

function eligible(field, results, [n, profile]) {
  return occupied(field.board) === n && results.profile === profile &&
    (profile !== "TACTICAL" || (results.opening.safe >= 2 && results.opening.dead / results.opening.legal <= .25));
}

const existing = [
  ...legacy.map(p => p.board),
  ...read("notebook-extra").map(([board]) => Array.from(board, Number)),
  ...read("content-pilot").map(([,board]) => Array.from(board, Number)),
  ...[4,5].flatMap(v => [...[1,2,3,4].flatMap(n=>read(`content-v${v}-books-${n}`)),
    ...read(`content-v${v}-daily`)].map(([board]) => Array.from(board, Number))),
];
const keys = new Set(existing.map(canonical)), masks = new Set(existing.map(mask)), shapes = new Set(existing.map(shapeKey));
function distinct(board) {
  return !keys.has(canonical(board)) && !masks.has(mask(board)) && !shapes.has(shapeKey(board));
}
function retain(board) {
  keys.add(canonical(board)); masks.add(mask(board)); shapes.add(shapeKey(board));
}

function author() {
  const changes = {};
  for (const [i, plan] of plans.entries()) {
    if (eligible(baseline[i], exact(baseline[i]), plan)) continue;
    assert(i >= 1);
    const random = v5Random("opening-v6:" + (i + 1)), [n] = plan;
    for (let attempt=0; attempt<1000; attempt++) {
      const rows = Math.min(n / 2, Math.ceil(n / WIDTH) + (i + attempt) % 4);
      const field = constructV5(n, rows, V5_STYLES[(i + attempt) % V5_STYLES.length], random);
      if (!field || !distinct(field.board) || new Set(field.board.filter(Boolean)).size < 4) continue;
      if (!eligible(field, exact(field), plan)) continue;
      changes[i + 1] = packV5(field);
      retain(field.board);
      break;
    }
    assert(changes[i + 1], `No matching opening field ${i + 1}`);
  }
  writeFileSync(overlayPath, JSON.stringify(changes,null,2) + "\n");
}

// Same policies, ordering and seeds as the independent v5 audit in PR #22.
function outcomes(board, slot) {
  function play(policy, seed) {
    let state = seed >>> 0, current = board;
    const random = () => {
      state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
      return (state >>> 0) / 4294967296;
    };
    const distance = ({ a,b }) => Math.max(Math.abs(Math.floor(b/WIDTH)-Math.floor(a/WIDTH)),Math.abs(b%WIDTH-a%WIDTH));
    let steps = 0;
    while (current.length) {
      const choices = pairs(current);
      if (!choices.length) break;
      let next = choices[0];
      if (policy === "random") next = choices[Math.floor(random()*choices.length)];
      if (policy === "near") for (const pair of choices) if (distance(pair)<distance(next)) next = pair;
      if (policy === "mobility") {
        let best = -Infinity;
        for (const pair of choices) {
          const after = removePair(current,pair.a,pair.b);
          const score = (after.length ? 0 : 1000) + pairs(after).length;
          if (score > best) { best=score; next=pair; }
        }
      }
      current = removePair(current,next.a,next.b);
      steps++;
    }
    return { win: !current.length, remaining: occupied(current), steps };
  }
  return { scan: play("scan",slot), near: play("near",slot), mobility: play("mobility",slot),
    random: Array.from({length:3},(_,i)=>play("random",Math.imul(slot,2654435761)+i*104729)) };
}

const authoring = process.argv.includes("--author");
if (authoring) author();
const overlay = read("notebook-opening-v6");
const records = [];
for (const slot of Object.keys(overlay).map(Number)) assert(Number.isInteger(slot) && slot >= 2 && slot <= 12);
for (const [i, plan] of plans.entries()) {
  const slot = i+1, row = overlay[slot];
  const field = row ? replayV5(row) : baseline[i];
  const proof = exact(field);
  assert(eligible(field,proof,plan), "Opening profile " + slot);
  if (row && !authoring) {
    assert(!eligible(baseline[i],exact(baseline[i]),plan), "Unnecessary replacement " + slot);
    assert(distinct(field.board), "Duplicate geometry " + slot);
    retain(field.board);
  }
  const trace = traceV5(field);
  const previous = baseline[i];
  records.push({ id: "book-v1-"+slot, revision: row ? 6 : i ? 5 : 1,
    rows: field.board.join("").match(/.{1,9}/g), witness: packV5(field)[1], geometry: geometry(field.board),
    proof, events: trace.events, episodes: trace.episodes,
    before: { board: previous.board.join(""), geometry: geometry(previous.board),
      proof: exact(previous), policies: outcomes(previous.board,slot) },
    policies: outcomes(field.board,slot) });
}
assert(records.slice(0,5).some(p => p.proof.edgeObligatory && p.proof.forcedEdge), "Mandatory edge lesson");
assert(new Set(records.map(r=>r.geometry.observed)).size >= 3, "Geometry diversity");
assert(records.every((r,i)=>i===0 || r.geometry.n !== records[i-1].geometry.n), "Adjacent size repeat");
assert.notEqual(records.at(-1).geometry.n, occupied(replayV5(v5[12]).board), "Repeat with task 13");
const aggregate = path => {
  const values = records.map(path);
  return { safe: values.reduce((n,r)=>n+r.proof.opening.safe,0), dead: values.reduce((n,r)=>n+r.proof.opening.dead,0),
    unknown: 0, totalStates: values.reduce((n,r)=>n+r.proof.states,0),
    wins: values.reduce((n,r)=>n+[r.policies.scan,r.policies.near,r.policies.mobility,...r.policies.random].filter(x=>x.win).length,0),
    runs: values.length * 6 };
};
const report = { retained: records.filter(r=>r.revision!==6).map(r=>r.id), before: aggregate(r=>r.before),
  after: aggregate(r=>r), slots: records };
if (process.argv.includes("--json")) process.stdout.write(JSON.stringify(report,null,2) + "\n");
else console.log(JSON.stringify({ before:report.before, after:report.after, retained:report.retained,
  slots: records.map(r=>[r.id,r.geometry.n,r.proof.profile,r.proof.opening.legal,r.proof.opening.dead,r.proof.states,r.proof.edgeObligatory]) },null,2));
