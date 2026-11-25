import overlay from "./notebook-opening-v6.json" with { type: "json" };
import { replayV5, type V5Row } from "./content-v5-generator";
import type { Puzzle } from "./puzzles";

const rows = overlay as unknown as Record<string, V5Row>;

export const hasOpeningRevision = (slot: number) => Object.hasOwn(rows, slot);
let cached: Puzzle | undefined;

export function openingPuzzle(id: string, slot: number): Puzzle | undefined {
  if (!hasOpeningRevision(slot)) return;
  if (cached?.id !== id) cached = { id, ...replayV5(rows[slot]) };
  return cached;
}
