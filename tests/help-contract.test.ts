import {test, expect} from "vitest";
import {fresh, metadata, helpProfile, serializeProgress, readProgress, FutureProgress} from "../src/progress";
import {receiptProduct, type HelpIntent} from "../src/help-contract";
import {grantReward, hintAttempt, spendHint} from "../src/hint-budget";
import {enqueueAnalytics} from "../src/analytics";
const receipt = (product: string, token = product) => ({version: 1, product, token, attempt: "old-attempt", intent_id: "intent", offer_id: "offer", ad_session_id: "session"});
test("legacy receipts remain hints; product grants deduplicate through the real wire", () => {
  let p = fresh();
  expect(grantReward(p, {token: "legacy", attempt: "old"})).toBe(true);
  for (const product of ["hint_pack_3", "magnet_1", "plan_1"]) {
    expect(grantReward(p, receipt(product))).toBe(true);
    p = readProgress(serializeProgress(p));
    expect(grantReward(p, receipt(product))).toBe(true);
  }
  expect(metadata(p).wallet).toBe(6);
  expect(helpProfile(p).inventory).toEqual({magnet: 1, plan: 1});
});
test("unknown and partially versioned receipts never guess a product", () => {
  for (const r of [{...receipt("magnet_1"), version: 2}, receipt("unknown"), {token: "one", attempt: "a", product: "magnet_1"}, {...receipt("magnet_1"), intent_id: ""}]) {
    const p = fresh(); expect(receiptProduct(r)).toBeUndefined(); expect(grantReward(p, r)).toBe(false);
    expect(metadata(p).wallet).toBe(0); expect(p.meta?.rewardReceipts).toBeUndefined();
  }
});
test("intent, assignment and every required join field survive the actual serializer", () => {
  const p = fresh(), profile = helpProfile(p);
  const intent: HelpIntent = {version: 1, id: "i", offer: "o", product: "hint_pack_3", task: "classic", attempt: hintAttempt(p).id, rules: 1, algorithm: "hint-v1", board: [5,5], pair: [0,1]};
  profile.intent = intent;
  profile.assignments.push({install: profile.install, experiment: "e", config: "v1", variant: "control", anchor: 123, cohort: "existing", qa: false});
  const data = {launch: "launch", occurred_at: 123, product: "hint_pack_3", intent_id: "i", offer_id: "o", attempt: "a", receipt: "r", ad_session_id: "s", application_id: "apply", install: profile.install, experiment: "e", variant: "control", config: "v1", algorithm: "hint-v1", mode: "classic", outcome: "revealed", qa: false};
  const event = enqueueAnalytics(metadata(p), "assist_apply", data);
  const q = readProgress(serializeProgress(p));
  expect(helpProfile(q)).toEqual(profile); expect(metadata(q).analytics?.[0]).toEqual(event);
});
test.each([2,3,4,5])("format %i migrates without inventing demo or losing earned hints", version => {
  const p = fresh(); metadata(p).wallet = 7; hintAttempt(p).hintKeys = ["one"];
  const wire = version < 4 ? {...p, version} : {...JSON.parse(serializeProgress(p)), version};
  const q = readProgress(JSON.stringify(wire)); expect(metadata(q).wallet).toBe(7);
  expect(q.sessions).toEqual(p.sessions); expect(hintAttempt(q).help).toBeUndefined();
  expect(helpProfile(q).demo).toEqual({magnet: false, plan: false});
});
test("new or corrupt assistance authority is protected instead of erased", () => {
  const p = fresh(); helpProfile(p).inventory.magnet = 9;
  for (const value of [2, 100]) {
    const wire = JSON.parse(serializeProgress(p)); wire.meta.help.version = value;
    expect(() => readProgress(JSON.stringify(wire))).toThrow(FutureProgress);
  }
  const wire = JSON.parse(serializeProgress(p)); wire.meta.help.inventory.magnet = -1;
  expect(() => readProgress(JSON.stringify(wire))).toThrow(FutureProgress);
  expect(JSON.parse(serializeProgress(p)).version).toBe(6);
});
test("an earned pack and a spent reveal are separate durable states", () => {
  const p = fresh(); const a = hintAttempt(p); a.hintKeys = ["one", "two", "three"];
  grantReward(p, receipt("hint_pack_3")); const granted = serializeProgress(p);
  expect(spendHint(p, "four")).toBe(true); const applied = serializeProgress(p);
  expect(metadata(readProgress(granted)).wallet).toBe(3);
  const restored = readProgress(applied); expect(metadata(restored).wallet).toBe(2);
  expect(spendHint(restored, "four")).toBe(true); expect(metadata(restored).wallet).toBe(2);
});
