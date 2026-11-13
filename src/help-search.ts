import {checkPair, pairs, removePair, occupied, WIDTH, MAX_CELLS} from "./core";
export type Pair = [number, number];
export type HelpProof = {pair: Pair; after: number[]; path: Pair[]; goal: "clear" | "row" | "moves"; opened: Pair[]};
export type SearchLimits = {candidates: number; nodes: number; ms: number};
export const HELP_LIMITS: SearchLimits = {candidates: 128, nodes: 4000, ms: 120};
export const HELP_ALGORITHM = "bounded-help-v1";
export type SearchResult = {status: "found" | "not_found" | "unknown"; proof?: HelpProof; stats: {candidates: number; nodes: number; ms: number; limited: boolean}};
export function removeMagnetPair(board: readonly number[], a: number, b: number): number[] {
  if (!Number.isInteger(a) || !Number.isInteger(b) || a === b || !board[a] || !board[b] ||
      (board[a] !== board[b] && board[a] + board[b] !== 10) || checkPair(board, a, b).ok) throw Error("Invalid magnet pair");
  const next = [...board]; next[a] = next[b] = 0;
  return next.flatMap((_, i) => i % WIDTH === 0 && next.slice(i,i+WIDTH).some(Boolean) ? next.slice(i,i+WIDTH) : []);
}
function identities(board: readonly number[], origins: number[], [a,b]: Pair) {
  const blank = [...board]; blank[a] = blank[b] = 0;
  const result: number[] = [];
  for (let row=0; row<blank.length; row+=WIDTH) if (blank.slice(row,row+WIDTH).some(Boolean)) result.push(...origins.slice(row,row+WIDTH));
  return result;
}
const key = (a: number,b: number) => `${Math.min(a,b)}:${Math.max(a,b)}`;
const rows = (board: readonly number[]) => Math.ceil(board.length / WIDTH);
/** Proof validator is also used at the transaction boundary, independently of search budgets. */
export function verifyHelpProof(before: readonly number[], proof: HelpProof, kind: "magnet" | "plan"): boolean {
  try {
    let board = kind === "magnet" ? removeMagnetPair(before, ...proof.pair) : [...before];
    if (kind === "magnet" && (board.length !== proof.after.length || board.some((n,i)=>n!==proof.after[i]))) return false;
    if (proof.path.length > 3 || (kind === "plan" && proof.path.length < 2)) return false;
    let origins = Array.from(before,(_,i)=>i);
    if (kind === "magnet") origins = identities(before,origins,proof.pair);
    const directlyOpened = new Set<string>();
    if (kind === "magnet") for (const p of pairs(board)) if (!checkPair(before,origins[p.a],origins[p.b]).ok) directlyOpened.add(key(origins[p.a],origins[p.b]));
    let usedOpened = false;
    for (const pair of proof.path) {
      if (!checkPair(board,...pair).ok) return false;
      usedOpened ||= directlyOpened.has(key(origins[pair[0]],origins[pair[1]]));
      const nextOrigins = identities(board,origins,pair);
      board = removePair(board,...pair); origins = nextOrigins;
    }
    if (kind === "magnet" && pairs(before).length && !usedOpened) return false;
    return proof.goal === "clear" ? occupied(board) === 0 : proof.goal === "row" ? rows(board) < rows(before) :
      kind === "magnet" && pairs(before).length === 0 && pairs(proof.after).length > 0;
  } catch { return false; }
}
export function searchHelp(before: readonly number[], kind: "magnet" | "plan", limits: SearchLimits = HELP_LIMITS): SearchResult {
  const started = performance.now();
  let nodes = 0, candidates = 0, limited = false;
  let best: HelpProof | undefined;
  const score = (p: HelpProof) => (p.goal === "clear" ? 0 : p.goal === "row" ? 100 : 200) + p.path.length;
  const tick = () => {
    if (++nodes > limits.nodes || performance.now()-started > limits.ms) {limited=true; return false;}
    return true;
  };
  const consider = (p: HelpProof) => {if ((!best || score(p) < score(best)) && verifyHelpProof(before,p,kind)) best=p;};
  const walk = (initial: number[], pair: Pair, opened: Pair[]) => {
    const visit = (board: number[], path: Pair[]) => {
      if (!tick()) return;
      if (kind === "magnet" || path.length >= 2) {
        const goal = !occupied(board) ? "clear" : rows(board) < rows(before) ? "row" :
          kind === "magnet" && path.length === 0 && !pairs(before).length && pairs(board).length ? "moves" : undefined;
        if (goal) consider({pair,after:initial,path:[...path],goal,opened});
      }
      if (path.length >= 3 || !board.length || limited) return;
      for (const p of pairs(board)) {visit(removePair(board,p.a,p.b),[...path,[p.a,p.b]]); if(limited)return;}
    };
    visit(initial,[]);
  };
  if (before.length > MAX_CELLS || !before.every(n=>Number.isInteger(n)&&n>=0&&n<=9)) limited=true;
  else if (kind === "plan") walk([...before],[0,1],[]);
  else {
    const occupiedIndices = before.flatMap((n,i)=>n?[i]:[]);
    outer: for (let x=0;x<occupiedIndices.length;x++) for (let y=x+1;y<occupiedIndices.length;y++) {
      if (!tick()) break outer;
      const a=occupiedIndices[x],b=occupiedIndices[y];
      if ((before[a]!==before[b] && before[a]+before[b]!==10)||checkPair(before,a,b).ok)continue;
      if (++candidates > limits.candidates) {limited=true;break outer;}
      const after=removeMagnetPair(before,a,b), origins=identities(before,Array.from(before,(_,i)=>i),[a,b]);
      const opened=pairs(after).filter(p=>!checkPair(before,origins[p.a],origins[p.b]).ok).map(p=>[origins[p.a],origins[p.b]] as Pair);
      walk(after,[a,b],opened); if(limited)break outer;
    }
  }
  // Exhaustion is never evidence of absence or permission to sell an unchecked effect.
  return {status: limited ? "unknown" : best ? "found" : "not_found", ...(best && !limited ? {proof:best} : {}),
    stats:{candidates,nodes,ms:performance.now()-started,limited}};
}
