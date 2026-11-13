import { checkPair, RULES_VERSION, MAX_CELLS } from "./core";

export const products = { hint_pack_3: 3, magnet_1: 1, plan_1: 1 } as const;
export type HelpProduct = keyof typeof products;
export type RewardReceipt = {
  token: string; attempt: string; version?: number; product?: string;
  intent_id?: string; offer_id?: string; ad_session_id?: string;
};
export type HelpIntent = {
  version: 1; id: string; offer: string; product: HelpProduct; task: string;
  attempt: string; rules: 1; algorithm: string; board: number[];
  pair: [number, number]; after?: number[]; proof?: [number, number][]; states?: number[][];
};
export type HelpEntitlement = { id: string; intent: HelpIntent; applications: string[]; applicationSequence?: number };
export type HelpAttempt = {
  version: 1; assisted: boolean; magnet?: HelpEntitlement; plan?: HelpEntitlement;
};
export type Assignment = {
  install: string; experiment: string; variant: "control" | "candidate";
  config: string; anchor: number; cohort: "new" | "existing"; qa: boolean;
};
export type HelpProfile = {
  version: 1; install: string; inventory: { magnet: number; plan: number };
  demo: { magnet: boolean; plan: boolean }; assignments: Assignment[];
  intent?: HelpIntent; followup?: HelpIntent; grant?: { token: string; intent: string; product: HelpProduct };
};
export function freshHelp(): HelpProfile {
  return {version: 1, install: crypto.randomUUID(), inventory: {magnet: 0, plan: 0},
    demo: {magnet: false, plan: false}, assignments: []};
}
export function receiptProduct(r: RewardReceipt): HelpProduct | undefined {
  if (!r || typeof r.token !== "string" || !r.token || r.token.length > 100 ||
      typeof r.attempt !== "string" || r.attempt.length > 100) return;
  // Only the exact legacy shape may inherit the old hint product.
  if (r.version === undefined && r.product === undefined && Object.keys(r).every(k => k === "token" || k === "attempt")) return "hint_pack_3";
  if (r.version !== 1 || !Object.hasOwn(products, r.product ?? "") ||
      ![r.intent_id, r.offer_id, r.ad_session_id].every(id => typeof id === "string" && id.length > 0 && id.length <= 100)) return;
  return r.product as HelpProduct;
}
export function freezeIntent(intent: HelpIntent): HelpIntent {
  Object.freeze(intent.board);Object.freeze(intent.pair);
  if(intent.after)Object.freeze(intent.after);
  if(intent.proof){intent.proof.forEach(Object.freeze);Object.freeze(intent.proof);}
  if(intent.states){intent.states.forEach(Object.freeze);Object.freeze(intent.states);}
  return Object.freeze(intent);
}
export function sameBoard(a: readonly number[], b: readonly number[]) {
  return a.length === b.length && a.every((n, i) => n === b[i]);
}
const id = (s: unknown): s is string => typeof s === "string" && s.length > 0 && s.length <= 100;
const board = (v: unknown): v is number[] => Array.isArray(v) && v.length <= MAX_CELLS && v.every(n => Number.isInteger(n) && n >= 0 && n <= 9);
export function readIntent(v: any): HelpIntent | undefined {
  if (v?.version !== 1 || ![v.id, v.offer, v.task, v.attempt, v.algorithm].every(id) ||
      v.rules !== RULES_VERSION || !Object.hasOwn(products, v.product ?? "") || !board(v.board) ||
      !Array.isArray(v.pair) || v.pair.length !== 2 || !v.pair.every((n: unknown) => Number.isInteger(n) && Number(n) >= 0 && Number(n) < v.board.length) || v.pair[0] === v.pair[1]) return;
  if (v.after !== undefined && !board(v.after)) return;
  if (v.proof !== undefined && (!Array.isArray(v.proof) || v.proof.length > 3 || !v.proof.every((p: any) => Array.isArray(p) && p.length === 2 && p.every((n: unknown) => Number.isInteger(n) && Number(n) >= 0 && Number(n) < MAX_CELLS)))) return;
  if(v.states !== undefined && (!Array.isArray(v.states)||v.states.length>4||!v.states.every(board)))return;
  if (v.product === "hint_pack_3" && !checkPair(v.board, ...v.pair as [number, number]).ok) return;
  return freezeIntent({version: 1, id: v.id, offer: v.offer, product: v.product, task: v.task, attempt: v.attempt,
    rules: 1, algorithm: v.algorithm, board: [...v.board], pair: [v.pair[0], v.pair[1]],
    ...(v.states ? {states:v.states.map((b:number[])=>[...b])} : {}),
    ...(v.after !== undefined ? {after: [...v.after]} : {}), ...(v.proof ? {proof: v.proof.map((p: number[]) => [...p])} : {})});
}
export function readHelp(v: any): HelpProfile {
  if (v?.version !== 1 || !id(v.install) || ![v.inventory?.magnet, v.inventory?.plan].every(n => Number.isSafeInteger(n) && n >= 0) ||
      typeof v.demo?.magnet !== "boolean" || typeof v.demo?.plan !== "boolean" || !Array.isArray(v.assignments) || v.assignments.length > 8) throw Error("Invalid help profile");
  const assignments = v.assignments.map((a: any): Assignment => {
    if (a.install !== v.install || !id(a.experiment) || !id(a.config) || !["control", "candidate"].includes(a.variant) || !["new", "existing"].includes(a.cohort) || !Number.isSafeInteger(a.anchor) || a.anchor < 0 || typeof a.qa !== "boolean") throw Error("Invalid assignment");
    return {...a};
  });
  const intent = v.intent === undefined ? undefined : readIntent(v.intent);
  if (v.intent !== undefined && !intent) throw Error("Invalid help intent");
  const followup = v.followup === undefined ? undefined : readIntent(v.followup);
  if (v.followup !== undefined && !followup) throw Error("Invalid follow-up");
  if (v.grant && (![v.grant.token, v.grant.intent].every(id) || !Object.hasOwn(products, v.grant.product ?? ""))) throw Error("Invalid grant context");
  return {version: 1, install: v.install, inventory: {...v.inventory}, demo: {...v.demo}, assignments,
    ...(intent ? {intent} : {}), ...(followup ? {followup} : {}), ...(v.grant ? {grant: {...v.grant}} : {})};
}
export function readHelpAttempt(v: any): HelpAttempt {
  if (v?.version !== 1 || typeof v.assisted !== "boolean") throw Error("Invalid assistance version");
  const result: HelpAttempt = {version: 1, assisted: v.assisted};
  for (const key of ["magnet", "plan"] as const) if (v[key] !== undefined) {
    const e = v[key], intent = readIntent(e?.intent);
    if (!id(e?.id) || !intent || intent.product !== `${key}_1` || !Array.isArray(e.applications) || e.applications.length > 32 || !e.applications.every(id)) throw Error("Invalid entitlement");
    if (e.applicationSequence !== undefined && (!Number.isSafeInteger(e.applicationSequence) || e.applicationSequence < 0)) throw Error("Invalid application sequence");
    result[key] = {id: e.id, intent, applications: [...e.applications], applicationSequence: e.applicationSequence ?? 0};
  }
  return result;
}
