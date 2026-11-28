import type { Progress } from "./progress";
import { dailyDay, dailyDone } from "./content-ids";

/** Presentation snapshot, captured with a write and published only on its ACK.
 * A cached, unopened session alone is not evidence that the player started it.
 * No decoration is persisted and no session/attempt is created by Home.
 */
export function homeDailySnapshot(p: Progress) {
  return {
    done: [...p.done],
    daily: p.meta?.daily ? {...p.meta.daily} : undefined,
    started: new Set(Object.entries(p.sessions).filter(([id, session]) =>
      dailyDay(id) && (p.active === id || p.meta?.attempts[id]?.analyticsStarted ||
        session.current.moves > 0 || session.current.additions > 0 || session.history.length > 0),
    ).map(([id]) => id)),
  };
}
export function homeDailyStatus(snapshot: ReturnType<typeof homeDailySnapshot>, day: string, id: string) {
  return dailyDone(snapshot.done, day) ? "done" : snapshot.started.has(id) ? "started" : "unplayed";
}
