import { describe, it, expect } from "vitest";
import {
  enqueueAnalytics,
  readAnalytics,
  acknowledgeAnalytics,
  CommittedAnalytics,
  type AnalyticsJournal,
} from "../src/analytics";
import {
  fresh,
  metadata,
  readProgress,
  serializeProgress,
} from "../src/progress";

describe("durable analytics journal", () => {
  it("survives a restart with the same event and attempt identities", () => {
    const p = fresh();
    const e = enqueueAnalytics(metadata(p), "game_complete", {
      attempt: "attempt-1",
      mode: "classic",
    });
    const restored = readProgress(serializeProgress(p));
    expect(metadata(restored).analytics).toEqual([e]);
    acknowledgeAnalytics(metadata(restored), e.id);
    expect(metadata(restored).analytics).toEqual([]);
    expect(p.sessions).toEqual(restored.sessions);
  });
  it("bounds optional telemetry and rejects malformed data without touching the board", () => {
    const j: AnalyticsJournal = {};
    for (let i = 0; i < 150; i++)
      enqueueAnalytics(j, "game_start", { attempt: String(i) });
    expect(j.analytics).toHaveLength(128);
    expect(j.analytics![0].data.attempt).toBe("22");
    expect(
      readAnalytics([
        { id: "x", name: "game_complete", data: { raw: { board: [1] } } },
        null,
      ]),
    ).toEqual([]);
  });
  it("does not send an unsaved event, retries failure, and suppresses stale snapshot replay", async () => {
    const j: AnalyticsJournal = {};
    const e = enqueueAnalytics(j, "game_complete", { attempt: "same" });
    const calls: string[] = [];
    let available = false;
    const pump = new CommittedAnalytics(async (event) => {
      calls.push(event.id);
      return available;
    });
    expect(calls).toEqual([]); // An event in memory is not a committed snapshot.
    const snapshot = [...j.analytics!];
    await pump.publish(snapshot, (id) => acknowledgeAnalytics(j, id));
    expect(j.analytics).toEqual([e]);
    available = true;
    await pump.publish(snapshot, (id) => acknowledgeAnalytics(j, id));
    await pump.publish(snapshot, (id) => acknowledgeAnalytics(j, id));
    expect(calls).toEqual([e.id, e.id]);
    expect(j.analytics).toEqual([]);
  });
  it("preserves ordering across overlapping saves and events queued during delivery", async () => {
    const j: AnalyticsJournal = {};
    const start = enqueueAnalytics(j, "game_start", { attempt: "a" });
    const seen: string[] = [];
    const pump = new CommittedAnalytics(async (e) => {
      await Promise.resolve();
      seen.push(e.name);
      return true;
    });
    const first = pump.publish([start], (id) => acknowledgeAnalytics(j, id));
    const end = enqueueAnalytics(j, "game_complete", { attempt: "a" });
    const second = pump.publish([start, end], (id) =>
      acknowledgeAnalytics(j, id),
    );
    await Promise.all([first, second]);
    expect(seen).toEqual(["game_start", "game_complete"]);
    expect(j.analytics).toEqual([]);
  });
});
