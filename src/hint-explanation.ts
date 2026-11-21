import { t } from "./i18n";
import type { Connection } from "./core";

/** Explain only what the revealed pair proves, without exposing other moves. */
export function hintExplanation(board: number[], pair: Connection): string {
  const value =
    board[pair.a] === board[pair.b]
      ? t("hint.equal", { "a": board[pair.a], "b": board[pair.b] })
      : `${board[pair.a]} + ${board[pair.b]} = 10`;
  const direction =
    pair.kind === "reading"
      ? t("hint.edge")
      : Math.floor(pair.a / 9) === Math.floor(pair.b / 9)
        ? t("hint.horizontal")
        : pair.a % 9 === pair.b % 9
          ? t("hint.vertical")
          : t("hint.diagonal");
  return `${value} · ${direction}`;
}
