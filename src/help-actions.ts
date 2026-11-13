import {commit, occupied, removePair, checkPair} from "./core";
import {cloneProgress, helpProfile, metadata, recordCompletion, type Progress} from "./progress";
import {hintAttempt} from "./hint-budget";
import {sameBoard, freezeIntent, type HelpIntent, type HelpEntitlement} from "./help-contract";
import {HELP_ALGORITHM, removeMagnetPair, verifyHelpProof, type HelpProof} from "./help-search";
export function helpIntent(p: Progress, kind: "magnet" | "plan", proof: HelpProof): HelpIntent {
  const before = p.sessions[p.active].current.board;
  if (p.active !== "classic" || !hintAttempt(p).help || !verifyHelpProof(before, proof, kind)) throw Error("Unproven effect");
  return freezeIntent({version: 1, id: crypto.randomUUID(), offer: crypto.randomUUID(), product: `${kind}_1`, task: p.active,
    attempt: hintAttempt(p).id, rules: 1, algorithm: HELP_ALGORITHM, board: [...before], pair: kind === "plan" ? [...proof.path[0]] : [...proof.pair], after: kind === "plan" ? proof.path.reduce((b,pair)=>removePair(b,...pair),[...before]) : [...proof.after], proof: proof.path.map(p=>[...p])});
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
  if (p.active !== "classic" || hintAttempt(p).id !== intent.attempt) throw Error("Stale attempt");
  const old = hintAttempt(p).help?.magnet;
  if (old && !entitlementMatches(old,intent)) throw Error("Attempt limit");
  const sequence = Number(application.slice(intent.id.length + 1));
  if (!application.startsWith(intent.id+":") || !Number.isSafeInteger(sequence) || sequence < 1) throw Error("Invalid application id");
  if (sequence <= (old?.applicationSequence ?? 0)) return {progress:p, session:p.sessions[p.active], duplicate:true};
  if (sequence !== (old?.applicationSequence ?? 0) + 1) throw Error("Out-of-order application");
  if (intent.product !== "magnet_1" || p.active !== "classic" || !sameBoard(p.sessions.classic.current.board,intent.board)) throw Error("Stale magnet");
  const kind = storedHelp(p,intent);
  if (!kind) throw Error("No magnet entitlement");
  if (!provenMagnet(intent)) throw Error("Invalid saved magnet proof");
  const candidate = cloneProgress(p), a = hintAttempt(candidate), profile = helpProfile(candidate);
  if (kind === "charge") profile.inventory.magnet--;
  if (kind === "demo") profile.demo.magnet = true;
  a.help!.assisted = true;
  a.help!.magnet ??= {id:intent.id,intent,applications:[],applicationSequence:0};
  a.help!.magnet.applicationSequence = sequence;
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

export function nextMagnetApplication(p: Progress, intent: HelpIntent) { return `${intent.id}:${(hintAttempt(p).help?.magnet?.applicationSequence ?? 0) + 1}`; }

const planCache=new WeakMap<HelpIntent,number[][]>();
export function planBoards(intent: HelpIntent): number[][] | undefined {
  const cached=planCache.get(intent);if(cached)return cached;
  if (intent.product !== "plan_1" || !intent.proof || intent.proof.length < 2 || intent.proof.length > 3 ||
      !sameBoard(intent.pair,intent.proof[0])) return;
  try {
    const states = [[...intent.board]];
    for (const pair of intent.proof) states.push(removePair(states.at(-1)!,...pair));
    const after = states.at(-1)!;
    const proof: HelpProof = {pair:intent.pair,after:intent.board,path:intent.proof,goal:after.length ? "row" : "clear",opened:[]};
    if (!sameBoard(after,intent.after ?? []) || !verifyHelpProof(intent.board,proof,"plan")) return;
    planCache.set(intent,states);
    return states;
  } catch {return;}
}
export function planPosition(p: Progress, session = p.sessions.classic) {
  const e = hintAttempt(p).help?.plan;
  if (!e || p.active !== "classic" || e.intent.attempt !== hintAttempt(p).id) return;
  const states=planBoards(e.intent);if(!states)return;
  const index=states.findIndex(b=>sameBoard(b,session.current.board));
  if(index<0)return {intent:e.intent,index,complete:false};
  const pair=e.intent.proof?.[index];
  const checked=pair ? checkPair(session.current.board,...pair) : undefined;
  return {intent:e.intent,index,complete:index===states.length-1,pair:checked?.ok ? checked.path : undefined};
}
export function applyPlan(p: Progress, intent: HelpIntent) {
  if (p.active !== "classic" || hintAttempt(p).id !== intent.attempt || !planBoards(intent)) throw Error("Unproven/stale plan");
  const old=hintAttempt(p).help?.plan;
  if(old) {
    if(!entitlementMatches(old,intent) || (planPosition(p)?.index ?? -1)<0)throw Error("Plan is on another branch");
    return {progress:p,session:p.sessions.classic,duplicate:true,source:"replay",entitlement:old.id};
  }
  if(!sameBoard(p.sessions.classic.current.board,intent.board))throw Error("Stale plan board");
  const source=storedHelp(p,intent);if(source!=="charge"&&source!=="demo")throw Error("No plan entitlement");
  const candidate=cloneProgress(p),a=hintAttempt(candidate),profile=helpProfile(candidate);
  if(source==="charge")profile.inventory.plan--;else profile.demo.plan=true;
  a.help!.assisted=true;
  a.help!.plan={id:intent.id,intent,applications:[intent.id+":1"],applicationSequence:1};
  profile.followup=intent;
  return {progress:candidate,session:candidate.sessions.classic,duplicate:false,source,entitlement:intent.id};
}
