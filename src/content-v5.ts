import dates from "./content-v5-daily.json" with { type: "json" };
import { dailyDay, dailyV5Index, legacyBookNumber } from "./content-ids";
import { continueV5Daily, replayV5, type V5Row } from "./content-v5-generator";
import type { Puzzle } from "./puzzles";

const bookBanks: (readonly V5Row[] | undefined)[] = [];
const bookImports = [
  () => import("./content-v5-books-1.json"),
  () => import("./content-v5-books-2.json"),
  () => import("./content-v5-books-3.json"),
  () => import("./content-v5-books-4.json"),
];
const bankOf = (number: number) => Math.floor((number - 1) / 600);

export async function loadBookV5(id: string) {
  const number = legacyBookNumber(id);
  if (!number) throw Error("Invalid v5 notebook ID");
  const bank = bankOf(number);
  if (!bookBanks[bank]) {
    const imported = (await bookImports[bank]()).default as unknown as V5Row[];
    if (imported.length !== 600) throw Error("Incomplete v5 notebook bank");
    bookBanks[bank] = imported;
  }
}
let lastBook: Puzzle | undefined;
export function bookV5(id: string): Puzzle | undefined {
  const number = legacyBookNumber(id);
  if (!number) return;
  if (lastBook?.id === id) return lastBook;
  const row = bookBanks[bankOf(number)]?.[(number - 1) % 600];
  if (row) return (lastBook = { id, ...replayV5(row) });
}
let lastDaily: Puzzle | undefined;
export function dailyV5(id: string): Puzzle | undefined {
  if (!id.startsWith("daily-v5-")) return;
  const day = dailyDay(id);
  if (!day) return;
  if (lastDaily?.id === id) return lastDaily;
  const index = dailyV5Index(day);
  const row = (dates as unknown as V5Row[])[index];
  if (index < 365 && !row) throw Error("Missing banked v5 date");
  const { board, solution } = row ? replayV5(row) : continueV5Daily(day, index);
  lastDaily = { id, board, solution };
  return lastDaily;
}
