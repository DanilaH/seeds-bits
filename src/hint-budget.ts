import { compactHintKey } from "./hint-key";
import { metadata, type Progress, type Attempt } from "./progress";
import type { RewardReceipt } from "./monetization";
export function hintKey(board: number[], a: number, b: number) {
  return compactHintKey(
    `${board.join("")}:${Math.min(a, b)}:${Math.max(a, b)}`,
  );
}
export function hintAttempt(p: Progress): Attempt {
  const m = metadata(p);
  return (m.attempts[p.active] ??= {
    id: crypto.randomUUID(),
    completed: false,
  });
}
export function hintsLeft(a: Attempt) {
  return Math.max(0, 3 + (a.hintBonus ?? 0) - (a.hintKeys?.length ?? 0));
}
export function spendHint(a: Attempt, key: string): boolean {
  if (a.hintKeys?.includes(key)) return true;
  if (!hintsLeft(a)) return false;
  (a.hintKeys ??= []).push(key);
  return true;
}
export function grantReward(p: Progress, r: RewardReceipt): boolean {
  const m = metadata(p);
  if (m.rewardReceipts?.includes(r.token)) return true;
  const a = Object.values(m.attempts).find((a) => a.id === r.attempt);
  if (!a || !r.token || r.token.length > 100) return false;
  a.hintBonus = (a.hintBonus ?? 0) + 3;
  (m.rewardReceipts ??= []).push(r.token);
  // Native holds one unacknowledged receipt; acknowledged receipts cannot be replayed.
  if (m.rewardReceipts.length > 500)
    m.rewardReceipts.splice(0, m.rewardReceipts.length - 500);
  return true;
}
