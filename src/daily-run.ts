import { dayNumber, localDay, validDay } from "./calendar";
import { metadata, type Progress } from "./progress";
export type DailyRun = {
  lastDay: string;
  count: number;
  best: number;
  reward: number;
};
export function streakReward(count: number) {
  return count === 3 ? 1 : count > 0 && count % 7 === 0 ? 3 : 0;
}
export function dailyRun(p: Progress, now = localDay()) {
  const s = metadata(p).daily;
  const current =
    s &&
    validDay(now) &&
    dayNumber(now) - dayNumber(s.lastDay) <= 1 &&
    now >= s.lastDay
      ? s.count
      : 0;
  const solvedToday = s?.lastDay === now;
  const nextCount = current + (solvedToday ? 0 : 1);
  const nextMilestone = solvedToday
    ? current < 3
      ? 3
      : (Math.floor(current / 7) + 1) * 7
    : nextCount <= 3
      ? 3
      : Math.ceil(nextCount / 7) * 7;
  return {
    count: current,
    best: s?.best ?? 0,
    solvedToday,
    nextCount,
    nextMilestone,
    until: nextMilestone - current,
  };
}
export function recordDaily(p: Progress, task: string, now = localDay()) {
  if (task !== `daily-v1-${now}` || !validDay(now)) return 0;
  const m = metadata(p),
    s = m.daily;
  // Strictly increasing completion dates also protect rollback/replayed saves in one stream.
  if (s && now <= s.lastDay) return 0;
  const count =
    s && dayNumber(now) - dayNumber(s.lastDay) === 1 ? s.count + 1 : 1;
  const reward = streakReward(count);
  m.daily = {
    lastDay: now,
    count,
    best: Math.max(s?.best ?? 0, count),
    reward,
  };
  m.wallet += reward;
  return reward;
}
