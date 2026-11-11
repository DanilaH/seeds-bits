/** Small durable journal for state-changing milestones, never for ad callbacks. */
export type EventData = Record<string, string | number | boolean>;
export type AnalyticsEvent = { name: string; data: EventData; id: string };
export type AnalyticsJournal = { analytics?: AnalyticsEvent[] };
const names =
  /^(game_start|game_complete|daily_reward|hint_reward_granted|tutorial_start|tutorial_end|first_pair|first_unassisted_pair|first_no_moves|first_hint|first_complete)$/;
export function readAnalytics(raw: unknown): AnalyticsEvent[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((e): e is AnalyticsEvent =>
      Boolean(
        e &&
        typeof e.id === "string" &&
        e.id.length <= 100 &&
        e.id.length > 0 &&
        typeof e.name === "string" &&
        names.test(e.name) &&
        e.data &&
        typeof e.data === "object" &&
        !Array.isArray(e.data) &&
        Object.keys(e.data).length <= 12 &&
        Object.entries(e.data).every(
          ([k, v]) =>
            k.length <= 40 &&
            (typeof v === "boolean" ||
              (typeof v === "number" && Number.isFinite(v)) ||
              (typeof v === "string" && v.length <= 100)),
        ),
      ),
    )
    .slice(-128);
}
export function enqueueAnalytics(
  journal: AnalyticsJournal,
  name: string,
  data: EventData = {},
) {
  if (!names.test(name)) throw Error("Unsupported durable event");
  const event = { name, data: { ...data }, id: crypto.randomUUID() };
  // Telemetry must never grow a save without limit or prevent playing offline.
  journal.analytics = [...(journal.analytics ?? []), event].slice(-128);
  return event;
}
export function acknowledgeAnalytics(journal: AnalyticsJournal, id: string) {
  journal.analytics = journal.analytics?.filter((e) => e.id !== id);
}

/** Only publish snapshots whose game write has succeeded. SDK acknowledgement is
 * local enqueue, NOT a server receipt. Stable IDs allow downstream deduplication. */
export class CommittedAnalytics {
  private queue = Promise.resolve();
  private accepted = new Set<string>();
  constructor(private report: (event: AnalyticsEvent) => Promise<boolean>) {}
  publish(events: AnalyticsEvent[], ack: (id: string) => void): Promise<void> {
    const snapshot = events.map((e) => ({ ...e, data: { ...e.data } }));
    this.queue = this.queue
      .catch(() => {})
      .then(async () => {
        for (const event of snapshot) {
          if (!this.accepted.has(event.id)) {
            let timer: ReturnType<typeof setTimeout> | undefined;
            try {
              const accepted = await Promise.race([
                this.report(event),
                new Promise<false>((resolve) => {
                  timer = setTimeout(() => resolve(false), 5000);
                }),
              ]);
              if (!accepted) break; // Retry with the next successful game snapshot.
              this.accepted.add(event.id);
              if (this.accepted.size > 512)
                this.accepted.delete(this.accepted.values().next().value!);
            } catch {
              break;
            } finally {
              clearTimeout(timer);
            }
          }
          ack(event.id);
        }
      });
    return this.queue;
  }
}
