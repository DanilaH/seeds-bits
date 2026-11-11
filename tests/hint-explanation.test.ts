import { expect, it } from "vitest";
import { hintExplanation } from "../src/hint-explanation";
it("explains values and the actual connection without inventing a strategy", () => {
  expect(hintExplanation([3, 7], { a: 0, b: 1, kind: "straight" })).toBe(
    "3 + 7 = 10 · по горизонтали",
  );
  const b = Array(20).fill(0);
  b[0] = 4;
  b[10] = 4;
  expect(hintExplanation(b, { a: 0, b: 10, kind: "straight" })).toContain(
    "Одинаковые цифры: 4 и 4 · по диагонали",
  );
  expect(hintExplanation(b, { a: 0, b: 10, kind: "reading" })).toContain(
    "по порядку чтения",
  );
});
