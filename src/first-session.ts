import { t, activeLanguage } from "./i18n";
import {pairs, WIDTH, type Board, type Connection} from "./core";

// The real first notebook task is the product entry. Explicit 0 is legacy QA only.
export const firstSessionEnabled = import.meta.env.VITE_SEEDS_FIRST_SESSION !== "0";
export const firstGuideId = "first-notebook-guide-v1";
export const openingGoal = () => t("open.tap");
export const gapCue = () => t("open.gap");
export const edgeCue = () => t("open.edge");

export function acrossGap(a: number, b: number) {
  return Math.max(Math.abs(a % WIDTH - b % WIDTH),
    Math.abs(Math.floor(a / WIDTH) - Math.floor(b / WIDTH))) > 1;
}

/** Only partners reachable now, including direction and occupied-cell checks. */
export function openingSelection(board: Board, selected: number): string {
  const value = board[selected];
  const values = new Set(pairs(board).flatMap(pair => pair.a === selected
    ? [board[pair.b]] : pair.b === selected ? [board[pair.a]] : []));
  if (!values.size) return t("open.noPartner");
  const equal = values.has(value), other = 10 - value;
  if (equal && (other === value || !values.has(other))) return t("open.equal", { "value": value });
  if (equal) return t("open.either", { "value": value, "other": other });
  return t("open.ten", { "other": other, "value": value });
}

export function requiredRule(available: readonly Connection[]): string | undefined {
  if (!available.length) return;
  if (available.every(pair => pair.kind === "reading")) return edgeCue();
  if (available.every(pair => pair.kind === "straight" && acrossGap(pair.a, pair.b))) return gapCue();
}

/** Local calendar date from the active task ID, never from the system's current day. */
export function taskDate(day: string, includeYear = false): string {
  const [year, month, date] = day.split("-").map(Number);
  return new Intl.DateTimeFormat(activeLanguage, {
    day:"numeric", month:"long", year:includeYear?"numeric":undefined, timeZone:"UTC",
  })
    .format(new Date(Date.UTC(year, month - 1, date)));
}
