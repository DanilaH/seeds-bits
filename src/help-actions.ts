import {commit, occupied} from "./core";
import {cloneProgress, helpProfile, metadata, recordCompletion, type Progress} from "./progress";
import {hintAttempt} from "./hint-budget";
import {sameBoard, type HelpIntent, type HelpEntitlement} from "./help-contract";
import {HELP_ALGORITHM, removeMagnetPair, verifyHelpProof, type HelpProof} from "./help-search";
export function helpIntent(p: Progress, kind: "magnet" | "plan", proof: HelpProof): HelpIntent {
  const before = p.sessions[p.active].current.board;
  if (p.active !== "classic" || !hintAttempt(p).help || !verifyHelpProof(before, proof, kind)) throw Error("Unproven effect");
  return {version: 1, id: crypto.randomUUID(), offer: crypto.randomUUID(), product: `${kind}_1`, task: p.active,
    attempt: hintAttempt(p).id, rules: 1, algorithm: HELP_ALGORITHM, board: [...before], pair: [...proof.pair], after: [...proof.after], proof: proof.path.map(p=>[...p])};
}
export function entitlementMatches(e: HelpEntitlement | undefined, intent: HelpIntent) {
  return Boolean(e && e.intent.id === intent.id && e.intent.attempt === intent.attempt &&
    sameBoard(e.intent.board,intent.board) && sameBoard(e.intent.pair,intent.pair) && sameBoard(e.intent.after ?? [],intent.after ?? []));
}
export function storedHelp(p: Progress, intent: HelpIntent): "replay" | "charge" | "demo" | undefined {
  if (p.active !== "classic" || intent.task !== p.active || hintAttempt(p).id !== intent.attempt || !hintAttempt(p).help) return;
  const kind = intent.product === "magnet_1" ? "magnet" : intent.product === "plan_1" ? "plan" : undefined;
  if (!kind) return;
  const existing = hintAttempt(p).help![kind];
  if (existing) return entitlementMatches(existing,intent) ? "replay" : undefined;
  const profile = metadata(p).help;
  if ((profile?.inventory[kind] ?? 0) > 0) return "charge";
  if (!profile?.demo[kind]) return "demo";
}
export function applyMagnet(p: Progress, intent: HelpIntent, application: string, scroll: number) {
  const old = hintAttempt(p).help?.magnet;
  if (old?.applications.includes(application)) return {progress:p, session:p.sessions[p.active], duplicate:true};
  if (intent.product !== "magnet_1" || p.active !== "classic" || !sameBoard(p.sessions.classic.current.board,intent.board)) throw Error("Stale magnet");
  const kind = storedHelp(p,intent);
  if (!kind) throw Error("No magnet entitlement");
  if (!provenMagnet(intent)) throw Error("Invalid saved magnet proof");
  const candidate = cloneProgress(p), a = hintAttempt(candidate), profile = helpProfile(candidate);
  if (kind === "charge") profile.inventory.magnet--;
  if (kind === "demo") profile.demo.magnet = true;
  a.help!.assisted = true;
  a.help!.magnet ??= {id:crypto.randomUUID(),intent,applications:[]};
  a.help!.magnet.applications = [...a.help!.magnet.applications,application].slice(-32);
  const session = commit(candidate.sessions.classic,removeMagnetPair(intent.board,...intent.pair),"magnet",scroll);
  candidate.sessions.classic = session;
  profile.followup = intent;
  if (!occupied(session.current.board)) recordCompletion(candidate,"classic");
  return {progress:candidate,session,duplicate:false,source:kind,entitlement:a.help!.magnet.id};
}

export function provenMagnet(intent: HelpIntent) {
  const proof: HelpProof = {pair:intent.pair,after:intent.after ?? [],path:intent.proof ?? [],goal:"moves",opened:[]};
  // A saved intent must still establish its concrete goal; never trust a saved 'after' alone.
  const valid = (["clear","row","moves"] as const).some(goal=>verifyHelpProof(intent.board,{...proof,goal},"magnet"));
  return valid;
}
