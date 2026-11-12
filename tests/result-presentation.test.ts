import { describe, it, expect } from "vitest";
import { resultKind } from "../src/result-presentation";
const tasks = Array.from({ length: 48 }, (_, i) => ({
  id: `book-v1-${i + 1}`,
}));
const ids = tasks.map((t) => t.id);
describe("result significance follows actual unique completion order", () => {
  it("distinguishes classic, daily and a single task", () => {
    expect(resultKind("classic", [], tasks)).toBe("classic");
    expect(resultKind("daily-v1-2026-11-12", [], tasks)).toBe("daily");
    expect(resultKind(ids[5], [ids[5]], tasks)).toBe("task");
  });
  it("recognizes a page finished out of numerical order", () => {
    expect(
      resultKind(ids[1], [ids[0], ...ids.slice(2, 6), ids[1]], tasks),
    ).toBe("page");
    expect(resultKind(ids[5], ids.slice(0, 5), tasks)).toBe("task");
  });
  it("does not turn every replay in a completed page into a milestone", () => {
    expect(resultKind(ids[0], ids.slice(0, 6), tasks)).toBe("task");
    expect(resultKind(ids[5], ids.slice(0, 6), tasks)).toBe("page");
  });
  it("book completion takes precedence and cannot be borrowed from another volume", () => {
    const done = [...ids.slice(0, 3), ...ids.slice(4, 24), ids[3], ids[24]];
    expect(resultKind(ids[3], done, tasks)).toBe("book");
    expect(resultKind(ids[24], done, tasks)).toBe("task");
    expect(resultKind(ids[0], done, tasks)).toBe("task");
  });
});
