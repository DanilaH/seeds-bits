import { compactHintKey } from "./hint-key";
import { metadata, type Progress, type Attempt } from "./progress";
import type { RewardReceipt } from "./monetization";
export function hintKey(board: number[], a: number, b: number) {
  return compactHintKey(
    `${board.join("")}:${Math.min(a, b)}:${Math.max(a, b)}`,
  );
}
export function hintAttempt(p: Progress): Attempt {
  return (metadata(p).attempts[p.active] ??= {
    id: crypto.randomUUID(),
    completed: false,
  });
}
export function hintsLeft(p: Progress) {
  return (
    Math.max(0, 3 - (hintAttempt(p).hintKeys?.length ?? 0)) + metadata(p).wallet
  );
}
export function spendHint(p: Progress, key: string): boolean {
  const a = hintAttempt(p);
  if (a.hintKeys?.includes(key)) return true;
  if (!hintsLeft(p)) return false;
  if ((a.hintKeys?.length ?? 0) >= 3) metadata(p).wallet--;
  (a.hintKeys ??= []).push(key);
  return true;
}
export function grantReward(p: Progress, r: RewardReceipt): boolean {
  const m = metadata(p);
  if (typeof r.token !== "string" || !r.token || r.token.length > 100)
    return false;
  if (m.rewardReceipts?.includes(r.token)) return true;
  // A pending native receipt remains earned even when its old attempt was replaced.
  m.wallet += 3;
  (m.rewardReceipts ??= []).push(r.token);
  // Native has only one unacknowledged receipt; acknowledgement is after durable save.
  if (m.rewardReceipts.length > 500)
    m.rewardReceipts.splice(0, m.rewardReceipts.length - 500);
  return true;
}
