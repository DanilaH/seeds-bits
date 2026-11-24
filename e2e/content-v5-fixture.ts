import { readFileSync } from "node:fs";
import { replayV5, type V5Row } from "../src/content-v5-generator";

export function bookV5Fixture(id: string) {
  const index = Number(id.slice(8)) - 1;
  const bank = JSON.parse(readFileSync(`src/content-v5-books-${Math.floor(index / 600) + 1}.json`, "utf8")) as V5Row[];
  return { id, ...replayV5(bank[index % 600]) };
}
