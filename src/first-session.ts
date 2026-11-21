import {pairs, WIDTH, type Board, type Connection} from "./core";

export const firstSessionEnabled = import.meta.env.VITE_SEEDS_FIRST_SESSION === "1";
export const firstGuideId = "first-notebook-guide-v1";
export const openingGoal = "Нажмите любую цифру.";
export const gapCue = "Пустые клетки можно пропускать.";
export const edgeCue = "От правого края — в начало строки ниже.";

export function acrossGap(a: number, b: number) {
  return Math.max(Math.abs(a % WIDTH - b % WIDTH),
    Math.abs(Math.floor(a / WIDTH) - Math.floor(b / WIDTH))) > 1;
}

/** Only partners reachable now, including direction and occupied-cell checks. */
export function openingSelection(board: Board, selected: number): string {
  const value = board[selected];
  const values = new Set(pairs(board).flatMap(pair => pair.a === selected
    ? [board[pair.b]] : pair.b === selected ? [board[pair.a]] : []));
  if (!values.size) return "У этой цифры пока нет пары. Выберите другую.";
  const equal = values.has(value), other = 10 - value;
  if (equal && (other === value || !values.has(other))) return `Найдите ещё одну ${value}.`;
  if (equal) return `Ещё ${value} или ${other}.\n${value} + ${other} = 10.`;
  return `Найдите ${other}: ${value} + ${other} = 10.`;
}

export function requiredRule(available: readonly Connection[]): string | undefined {
  if (!available.length) return;
  if (available.every(pair => pair.kind === "reading")) return edgeCue;
  if (available.every(pair => pair.kind === "straight" && acrossGap(pair.a, pair.b))) return gapCue;
}

/** Local calendar date from the active task ID, never from the system's current day. */
export function taskDate(day: string): string {
  const [year, month, date] = day.split("-").map(Number);
  return new Intl.DateTimeFormat("ru-RU", {day:"numeric", month:"long", timeZone:"UTC"})
    .format(new Date(Date.UTC(year, month - 1, date)));
}
