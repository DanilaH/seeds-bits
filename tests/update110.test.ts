import { test, expect } from "vitest";
import {
  fresh,
  metadata,
  recordCompletion,
  readProgress,
  serializeProgress,
  startAttempt,
} from "../src/progress";
import { validDay } from "../src/calendar";
import { availableDay, days, puzzleSession, daily } from "../src/puzzles";
import { recordDaily, dailyRun } from "../src/daily-run";
import { jars, jarState, migrateJars, legacyJarCapacity } from "../src/jars";

test("real Gregorian dates only, including imported daily IDs", () => {
  for (const day of [
    "2026-00-10",
    "2026-13-01",
    "2026-02-29",
    "2100-02-29",
    "2025-04-31",
    "2026-01-00",
  ]) {
    expect(validDay(day)).toBe(false);
    expect(availableDay(day, "9999-12-31")).toBe(false);
    const p = fresh();
    p.done = [`daily-v1-${day}`];
    expect(readProgress(JSON.stringify(p)).done).toEqual([]);
  }
  expect(validDay("2400-02-29")).toBe(true);
  expect(availableDay("2028-02-29", "2028-02-29")).toBe(true);
  expect(days("2026-13")).toEqual([]);
});
test("legacy jars retain collected indices, fraction and lifetime total even very far ahead", () => {
  for (const seeds of [
    0, 23, 24, 83, 84, 339, 340, 4000, 10000, 1000000, 2000000000,
  ]) {
    let index = 0,
      left = seeds;
    while (index < 18 && left >= legacyJarCapacity(index))
      left -= legacyJarCapacity(index++);
    if (index === 18) {
      index += Math.floor(left / 2000);
      left %= 2000;
    }
    const migrated = migrateJars({
      version: 1,
      seeds,
      wins: 20,
      attempt: "a",
      highWater: 9,
    });
    const current = jarState(migrated.meter);
    expect(migrated.seeds).toBe(seeds);
    expect(current.index).toBe(index);
    expect(current.percent).toBeGreaterThanOrEqual(
      Math.floor((left / legacyJarCapacity(index)) * 100),
    );
    expect(
      Math.abs(
        current.filled / current.capacity - left / legacyJarCapacity(index),
      ),
    ).toBeLessThan(0.042);
  }
});
test("first unique tasks earn seeds; historical completions and replays do not", () => {
  const p = fresh(),
    task = daily("2026-11-08");
  p.active = task.id;
  p.sessions[task.id] = puzzleSession(task);
  metadata(p);
  const earned = recordCompletion(p, task.id, "2026-11-08");
  expect(earned.seeds).toBeGreaterThanOrEqual(4);
  expect(earned.seeds).toBeLessThanOrEqual(24);
  expect(recordCompletion(p, task.id, "2026-11-08").seeds).toBe(0);
  startAttempt(p, task.id);
  expect(recordCompletion(p, task.id, "2026-11-08").seeds).toBe(0);
  expect(jars(p).seeds).toBe(earned.seeds);
  const q = fresh();
  q.done = [task.id];
  q.sessions[task.id] = puzzleSession(task);
  expect(recordCompletion(q, task.id, "2026-11-08").seeds).toBe(0);
});
test("consecutive dates pay at 3 and multiples of 7, remain idempotent after reload", () => {
  let p = fresh();
  for (let n = 1; n <= 14; n++) {
    const day = `2026-11-${String(n).padStart(2, "0")}`;
    const gain = recordDaily(p, `daily-v1-${day}`, day);
    expect(gain).toBe(n === 3 ? 1 : n % 7 === 0 ? 3 : 0);
    expect(recordDaily(p, `daily-v1-${day}`, day)).toBe(0);
    p = readProgress(serializeProgress(p));
    expect(dailyRun(p, day).count).toBe(n);
  }
  expect(metadata(p).wallet).toBe(7);
  expect(dailyRun(p, "2026-11-15").count).toBe(14);
  expect(dailyRun(p, "2026-11-16").count).toBe(0);
  expect(recordDaily(p, "daily-v1-2026-11-16", "2026-11-16")).toBe(0);
  expect(dailyRun(p, "2026-11-16")).toMatchObject({ count: 1, best: 14 });
  expect(metadata(p).wallet).toBe(7);
  expect(recordDaily(p, "daily-v1-2026-11-14", "2026-11-14")).toBe(0);
});
test("archives and a previous day's unfinished game cannot fill a live streak", () => {
  const p = fresh();
  p.done = ["daily-v1-2026-11-01", "daily-v1-2026-11-02"];
  expect(dailyRun(p, "2026-11-08").count).toBe(0);
  expect(recordDaily(p, "daily-v1-2026-11-07", "2026-11-08")).toBe(0);
  expect(recordDaily(p, "daily-v1-2026-11-08", "2026-11-08")).toBe(0);
  expect(dailyRun(p, "2026-11-08").count).toBe(1);
});
test("year/month and leap transitions are consecutive calendar days", () => {
  for (const dates of [
    ["2026-12-31", "2027-01-01"],
    ["2028-02-28", "2028-02-29", "2028-03-01"],
  ]) {
    const p = fresh();
    for (const day of dates) recordDaily(p, `daily-v1-${day}`, day);
    expect(dailyRun(p, dates.at(-1)!).count).toBe(dates.length);
  }
});
