import type { Connection } from "./core";

/** Explain only what the revealed pair proves, without exposing other moves. */
export function hintExplanation(board: number[], pair: Connection): string {
  const value =
    board[pair.a] === board[pair.b]
      ? `Одинаковые цифры: ${board[pair.a]} и ${board[pair.b]}`
      : `${board[pair.a]} + ${board[pair.b]} = 10`;
  const direction =
    pair.kind === "reading"
      ? "по порядку чтения"
      : Math.floor(pair.a / 9) === Math.floor(pair.b / 9)
        ? "по горизонтали"
        : pair.a % 9 === pair.b % 9
          ? "по вертикали"
          : "по диагонали";
  return `${value} · ${direction}`;
}
