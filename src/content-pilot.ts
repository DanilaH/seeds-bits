import packed from "./content-pilot.json" with { type: "json" };
import { checkPair, removePair, occupied, type Connection } from "./core";
import { pilotBookId, pilotDayIndex, dailyDay } from "./content-ids";
import type { Puzzle } from "./puzzles";

// Frozen research bank, PR17 86059fd; do not regenerate or reorder published IDs.
const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_";
function unpack(row: string[], id = row[0]): Puzzle {
  const [,digits,proof] = row;
  const board = [...digits].map(Number);
  let b = board;
  const solution: Connection[] = [];
  if (proof.length%2) throw Error("Incomplete pilot proof: "+id);
  for (let i=0;i<proof.length;i+=2) {
    const checked=checkPair(b,alphabet.indexOf(proof[i]),alphabet.indexOf(proof[i+1]));
    if (!checked.ok) throw Error("Invalid pilot proof: "+id);
    solution.push(checked.path);
    b=removePair(b,checked.path.a,checked.path.b);
  }
  if (occupied(b)!==0) throw Error("Unsolved pilot: "+id);
  return {id,board,solution};
}
export const pilotBooks = packed.filter(r=>pilotBookId(r[0])).map(r=>unpack(r));
const dailyRows = packed.filter(r=>r[0].startsWith("daily-pilot-v3-"));
export function pilotDaily(id: string): Puzzle | undefined {
  if (!id.startsWith("daily-v3-")) return;
  const day=dailyDay(id);
  if (!day) return;
  const index=pilotDayIndex(day);
  const row=dailyRows[index];
  if (!row || row[0]!== "daily-pilot-v3-"+(index+1)) throw Error("Missing pilot daily: "+id);
  return unpack(row,id);
}
