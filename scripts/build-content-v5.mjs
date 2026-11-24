// Node 24+. Run from the project root. The default audit never rewrites the frozen banks.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { gzipSync, gunzipSync } from "node:zlib";

registerHooks({ resolve(specifier, context, next) {
  try { return next(specifier, context); }
  catch (error) {
    if (error.code !== "ERR_MODULE_NOT_FOUND" || !specifier.startsWith(".")) throw error;
    return next(specifier + ".ts", context);
  }
}});
const core = await import("../src/core.ts");
const { continueV5Daily, dailyV5Size, packV5, replayV5, V5_SEED, survivingIndices } = await import("../src/content-v5-generator.ts");
const historic = await import("../src/puzzles.ts");
const { authorV5, canonical, controls, dateSlot, geometry, groups, mask, sampleV5, shapeKey, slots, traceV5, riskSummary } =
  await import("./author-content-v5.mjs");
const { createAuthor } = await import("./author-content-v4.mjs");
const exactV4 = createAuthor(core);
const ROOT = "docs/research/daily-notebook-design-2026-11-24/catalogue-v5";
const OLD = "docs/research/daily-notebook-design-2026-11-24/catalogue-v4";
const start = "2026-12-25";
const days = (base, i) => new Date(Date.parse(base + "T12:00:00Z") + i * 86400000).toISOString().slice(0, 10);
const read = file => JSON.parse(readFileSync(file, "utf8"));
const output = (file, value) => writeFileSync(file, JSON.stringify(value) + "\n");
const action = process.argv[2] ?? "--check";
if (!["--controls","--write","--check","--reproduce"].includes(action)) throw Error("Unknown action: "+action);
mkdirSync(ROOT, {recursive:true});

const files = ["src/notebook.json", "src/notebook-extra.json", "src/content-pilot.json",
  ...[1,2,3,4].map(n=>`src/content-v4-books-${n}.json`), "src/content-v4-daily.json"];
const hashes = Object.fromEntries(files.map(file=>[file,createHash("sha256").update(readFileSync(file)).digest("hex")]));
const exclusion = { keys: new Set(), masks: new Set(), shapes: new Set() };
const addHistory = board => {
  if (!core.occupied(board)) return;
  exclusion.keys.add(canonical(board));
  exclusion.masks.add(mask(board));
  exclusion.shapes.add(shapeKey(board));
};
for (const p of read(files[0])) addHistory(p.board);
for (const [board] of read(files[1])) addHistory([...board].map(Number));
for (const [,board] of read(files[2])) addHistory([...board].map(Number));
for (const file of files.slice(3)) for (const [board] of read(file)) addHistory([...board].map(Number));
const oldExclusions = read(OLD + "/exclusions.json");
for (const key of oldExclusions.canonical) addHistory([...key].map(Number));
for (const key of oldExclusions.masks) exclusion.masks.add(mask([...key].map(Number)));
for (let i = 0; i < 1461; i++) addHistory(historic.daily(days("2025-01-01", i)).board);
for (let i = 365; i < 730; i++) addHistory(historic.futureDailyV4(days(start, i)).board);
for (const day of ["2028-12-31","2029-01-01","2100-02-28","2100-03-01","2400-02-29"]) {
  addHistory(historic.daily(day).board);
  addHistory(historic.futureDailyV4(day).board);
}
const historical = { canonical: exclusion.keys.size, masks: exclusion.masks.size,
  datesV1: "2025-01-01..2028-12-31 plus listed year/leap boundary probes",
  datesV4Continuation: "2027-12-25..2028-12-23 plus listed boundary probes" };
console.log("Historical exclusions", historical);

const scheduled = Array.from({length:100},(_,v)=>slots(v+1));
const authorOrder = [...controls, ...Array.from({length:100},(_,i)=>i+1).filter(i=>!controls.includes(i))];
const bankFiles = [...[1,2,3,4].map(i=>`src/content-v5-books-${i}.json`), "src/content-v5-daily.json"];
const extending = Array.from({length:365}, (_,i)=>days(start,365+i)).concat(
  ["2028-12-24","2028-12-25","2028-12-31","2029-01-01","2100-02-28","2100-03-01","2400-02-29"]);
const adopted = { book: Array(2400), daily: [], continuation: [] };
const acceptRow = (row, expected, strictExclusion = true) => {
  const field = replayV5(row);
  assert.equal(core.occupied(field.board), expected);
  if (strictExclusion) {
    const key = canonical(field.board), pattern = mask(field.board), shape = shapeKey(field.board);
    assert(!exclusion.keys.has(key), `duplicate canonical ${row[0]}`);
    assert(!exclusion.masks.has(pattern), `duplicate mask ${row[0]}`);
    if (expected >= 56) assert(!exclusion.shapes.has(shape), `mirrored / shifted equivalent ${row[0]}`);
    exclusion.keys.add(key); exclusion.masks.add(pattern); exclusion.shapes.add(shape);
  }
  return field;
};

function verifyEvidence({row, passport, proof}, strictExclusion) {
  const field = acceptRow(row, passport.requested.n, strictExclusion);
  assert.deepEqual(geometry(field.board), passport.geometry);
  const trace = traceV5(field);
  assert.deepEqual(trace.events, passport.events);
  assert.equal(trace.steps[0].legal.length, passport.opening);
  assert.equal(trace.steps.length, passport.depth);
  assert.deepEqual(JSON.parse(JSON.stringify(sampleV5(trace, passport.exact))), JSON.parse(JSON.stringify(proof.checkpoints)));
  if (passport.exact) {
    assert.deepEqual(exactV4.classify(field.board, field.solution, passport.profile, "mix", 10_000), passport.exact);
  }
  for (const checkpoint of proof.checkpoints) {
    const state = Array.from(checkpoint.board, Number);
    const alternatives = [...checkpoint.alternatives.map(a=>a.pair), ...checkpoint.notChecked];
    assert.equal(alternatives.length + 1, core.pairs(state).length);
    for (const alternative of checkpoint.alternatives) {
      assert(alternative.used <= alternative.budget);
      assert(core.checkPair(state, ...alternative.pair).ok);
      if (alternative.result !== "FOUND") {
        assert.equal(alternative.proof, undefined);
        continue;
      }
      const after = core.removePair(state, ...alternative.pair);
      if (after.length) replayV5([after.join(""), alternative.proof]);
      else assert.equal(alternative.proof.length, 0);
    }
  }
  if (passport.geometry.n >= 56) {
    assert(proof.episodes.some(e=>e.interZone));
    assert(new Set(proof.episodes.map(e=>e.type)).size>=2);
    assert.deepEqual(proof.episodes, trace.episodes);
    for (const episode of proof.episodes) {
      const before = Array.from(episode.before, Number);
      const blank = Array.from(episode.uncompressed, Number);
      const after = Array.from(episode.after, Number);
      const [a,b] = episode.opened;
      assert.deepEqual(core.removePair(before, ...episode.move), after);
      assert(core.checkPair(after,a,b).ok);
      assert.deepEqual(episode.removed, episode.move.map(i=>episode.beforeIds[i]));
      assert.deepEqual(episode.stable, [episode.afterIds[a],episode.afterIds[b]]);
      assert.deepEqual(episode.afterIds, survivingIndices(blank).map(i=>episode.beforeIds[i]));
      const prior = episode.stable.map(id=>episode.beforeIds.indexOf(id));
      assert(!core.checkPair(before,...prior).ok);
      assert.equal(core.checkPair(blank,...prior).ok, (episode.cause??episode.type)==="reveal");
      if (episode.type==="chain") assert.deepEqual(
        field.solution.slice(episode.step+1,episode.step+2).map(({a,b})=>[Math.min(a,b),Math.max(a,b)]),
        [[Math.min(...episode.opened),Math.max(...episode.opened)]],
      );
    }
  }
}

function describe(passports) {
  const sizes = passports.map(p=>p.geometry.n).sort((a,b)=>a-b);
  const total = sizes.length, median = (sizes[Math.floor((total-1)/2)] + sizes[Math.ceil((total-1)/2)])/2;
  const risk = { found:0, losing:0, unknown:0, notChecked:0 };
  const profiles = {}, categories = [0,0,0], shapes = new Set();
  for (const p of passports) {
    categories[p.requested.category]++;
    profiles[p.profile]=(profiles[p.profile]??0)+1;
    shapes.add(p.geometry.observed);
    for (const key of Object.keys(risk)) risk[key] += p.risk[key];
  }
  return { mean:sizes.reduce((s,n)=>s+n,0)/total, median, p10:sizes[Math.ceil(total*.10)-1],
    p90:sizes[Math.ceil(total*.90)-1], min:sizes[0], max:sizes.at(-1), categories, profiles, risk,
    geometries:shapes.size, densityRange:[Math.min(...passports.map(p=>p.geometry.density)),Math.max(...passports.map(p=>p.geometry.density))] };
}
function checkVolume(passports, volume) {
  const metric = describe(passports);
  const group = groups.find(g=>volume<=g.end);
  assert.equal(passports.length,24);
  assert.deepEqual(metric.categories,group.counts,`categories ${volume}`);
  assert(metric.geometries>=3,`measured geometries ${volume}`);
  assert(metric.densityRange[1]-metric.densityRange[0]>.12,`density spread ${volume}`);
  for (let i=1;i<24;i++) assert.notEqual(passports[i].geometry.n,passports[i-1].geometry.n,`adjacent size ${volume}`);
  if (volume>=51) assert(passports.some((p,i)=>i&&p.requested.category===0&&passports[i-1].requested.category===2));
  for (let i=2;i<24;i++) assert(!passports.slice(i-2,i+1).every(p=>p.requested.category===2));
  if (volume>=76) assert(metric.max>=90);
  if (volume===65) assert.equal(metric.max,72);
  if ([95,100].includes(volume)) assert.equal(metric.max,108);
  return metric;
}

const frozen = action === "--check"
  ? JSON.parse(gunzipSync(readFileSync(ROOT+"/evidence.json.gz"))) : undefined;
const frozenRows = action === "--check" ? bankFiles.map(read) : undefined;
for (const volume of authorOrder) {
  const list = scheduled[volume-1].map((slot,i)=>{
    const index = (volume-1)*24+i;
    if (index === 0) {
      const p = historic.notebook[0], row = packV5(p), trace = traceV5(p), checkpoints = sampleV5(trace);
      assert.equal(core.occupied(p.board),8);
      return { row, passport: { id:slot.id, requested:slot, profile:"fixed-onboarding", verification:"WITNESS_ONLY",
        geometry:geometry(p.board), style:"legacy", opening:trace.steps[0].legal.length, depth:trace.steps.length,
        events:trace.events, leading:"reveal", risk:riskSummary(checkpoints), attempts:0 },
        proof:{ id:slot.id, checkpoints, episodes:[] } };
    }
    if (frozen) {
      const row = frozenRows[Math.floor(index/600)][index%600], meta = frozen.book[index];
      const item = {row, ...meta};
      assert.deepEqual(meta.passport.requested,slot);
      verifyEvidence(item,true);
      return item;
    }
    const item = authorV5(slot,exclusion);
    if (controls.includes(volume)) verifyEvidence(item,false);
    return item;
  });
  checkVolume(list.map(x=>x.passport),volume);
  list.forEach((item,i)=>adopted.book[(volume-1)*24+i]=item);
  if (controls.includes(volume) || volume%10===0) console.log("Notebook",volume,"PASS",JSON.stringify(describe(list.map(x=>x.passport))));
  if (volume === controls.at(-1) && action !== "--check") {
    const selected = controls.flatMap(n=>adopted.book.slice((n-1)*24,n*24));
    const showcases = controls.flatMap(volume => {
      const tasks = adopted.book.slice((volume-1)*24,volume*24);
      const peak = [...tasks].sort((a,b)=>b.passport.geometry.n-a.passport.geometry.n)[0];
      const contrast = [...tasks].filter(x=>x!==peak).sort((a,b)=>
        a.passport.geometry.density-b.passport.geometry.density)[0];
      const risk = [...tasks].filter(x=>x!==peak && x!==contrast)
        .sort((a,b)=>b.passport.risk.losing-a.passport.risk.losing)[0];
      return volume>=65 ? [peak,contrast,risk] : [peak,contrast];
    });
    const gate = {count:selected.length, volumes:controls, cases:showcases.map(x=>x.passport.id), pass:true};
    if (action !== "--reproduce") output(ROOT+"/controls.json",{gate, showcases, volumes: controls.map(n=>({
      volume:n, tasks: adopted.book.slice((n-1)*24,n*24).map(({passport})=>passport) }))});
    console.log("CONTROL GATE",JSON.stringify(gate));
    if (action==="--controls") process.exit(0);
  }
}

for (let i=0;i<365;i++) {
  const slot = dateSlot(days(start,i),i);
  if (frozen) {
    const item = {row:frozenRows.at(-1)[i],...frozen.daily[i]};
    assert.deepEqual(item.passport.requested,slot);
    verifyEvidence(item,true);
    adopted.daily.push(item);
  } else adopted.daily.push(authorV5(slot,exclusion));
}
for (const day of extending) {
  const i = Math.floor((Date.parse(day+"T12:00:00Z")-Date.parse(start+"T12:00:00Z"))/86400000);
  const current = continueV5Daily(day,i);
  assert.deepEqual(current, continueV5Daily(day,i));
  const row = packV5(current);
  const field = acceptRow(row,dailyV5Size(i));
  const trace = traceV5(field);
  const checkpoints = sampleV5(trace);
  adopted.continuation.push({ day, fallback:current.fallback, size:core.occupied(current.board), row,
    geometry:geometry(current.board), verification:"SAMPLED", checkpoints, risk:riskSummary(checkpoints), events:trace.events });
}
// Compare large starts of the same size and cropped dimensions up to reflection.
const large = adopted.book.filter(x=>x.passport.geometry.n>=56);
const near = { compared:0, closest:[] };
for (const [i, a] of large.entries()) {
  const am = shapeKey(Array.from(a.row[0], Number)).split("/");
  for (const b of large.slice(i+1)) {
    if (a.passport.geometry.n !== b.passport.geometry.n) continue;
    const bm = shapeKey(Array.from(b.row[0], Number)).split("/");
    if (am.length !== bm.length || am[0].length !== bm[0].length) continue;
    near.compared++;
    const forms = [bm,[...bm].reverse(),bm.map(s=>[...s].reverse().join("")),
      [...bm].reverse().map(s=>[...s].reverse().join(""))];
    const overlap = Math.max(...forms.map(rows=>rows.reduce((n,row,j)=>n+[...row].filter((c,k)=>c==="1"&&am[j][k]==="1").length,0)));
    const similarity = overlap/(2*a.passport.geometry.n-overlap);
    assert(similarity<1, "Large mirrored or shifted repetition");
    if (near.closest.length<8 || similarity>near.closest.at(-1).similarity) {
      near.closest.push({a:a.passport.id,b:b.passport.id,similarity});
      near.closest.sort((a,b)=>b.similarity-a.similarity);
      if (near.closest.length>8) near.closest.pop();
    }
  }
}
const summary = {
  seed:V5_SEED, hashes, historical, near,
  notebooks:scheduled.map((_,i)=>({volume:i+1,...checkVolume(adopted.book.slice(i*24,i*24+24).map(x=>x.passport),i+1)})),
  daily:{...describe(adopted.daily.map(x=>x.passport)), from:start,to:days(start,364),
    regular:adopted.daily.filter(x=>x.passport.geometry.n<38).length,long:adopted.daily.filter(x=>x.passport.geometry.n>=38).length},
  future:{...describe(adopted.continuation.map(x=>({geometry:x.geometry,requested:{category:x.size>=38?2:x.size>=28?1:0},
    profile:"sampled",risk:x.risk}))),
    dates:adopted.continuation.length,from:extending[0],through:extending[364],
    extraProbes:extending.slice(365),fallback:adopted.continuation.filter(x=>x.fallback).length},
};
assert.equal(summary.daily.regular,313);
assert.equal(summary.daily.long,52);
const evidence = {book:adopted.book.map(({passport,proof})=>({passport,proof})),
  daily:adopted.daily.map(({passport,proof})=>({passport,proof})), continuation:adopted.continuation};
const banks = [...[0,1,2,3].map(i=>adopted.book.slice(i*600,i*600+600).map(x=>x.row)),adopted.daily.map(x=>x.row)];
if (action === "--write") {
  bankFiles.forEach((file,i)=>output(file,banks[i]));
  output(ROOT+"/summary.json",summary);
  writeFileSync(ROOT+"/evidence.json.gz",gzipSync(JSON.stringify(evidence),{level:9}));
} else if (action === "--reproduce" || action === "--check") {
  bankFiles.forEach((file,i)=>assert.deepEqual(read(file),banks[i]));
  assert.deepEqual(read(ROOT+"/summary.json"), summary);
  assert.deepEqual(JSON.parse(gunzipSync(readFileSync(ROOT+"/evidence.json.gz"))),JSON.parse(JSON.stringify(evidence)));
}
console.log("V5 catalogue PASS",JSON.stringify({book:adopted.book.length,daily:summary.daily,future:summary.future}));
