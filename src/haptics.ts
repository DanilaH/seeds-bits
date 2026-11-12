import { Capacitor, registerPlugin } from "@capacitor/core";

/** Road Lines native recipe, with a monotonic cancellation barrier. See docs/FEEL_2026-11-09.md. */
export type HapticCue =
  | "button"
  | "select"
  | "pair"
  | "undo"
  | "hint"
  | "reject"
  | "land"
  | "full"
  | "win";
interface NativeFeedback {
  configure(options: { enabled: boolean; epoch: number }): Promise<void>;
  pulse(options: {
    cue: HapticCue;
    epoch: number;
    issuedAt: number;
  }): Promise<void>;
}
const native = registerPlugin<NativeFeedback>("SeedsFeedback");
const android = Capacitor.getPlatform() === "android";
let enabled = false,
  blocked = true,
  epoch = 0;
let configured = Promise.resolve(),
  last = -Infinity,
  lastPriority = 0,
  protectedUntil = 0;
const profiles: Record<
  HapticCue,
  { pattern: number | number[]; priority: number; hold?: number }
> = {
  button: { pattern: 14, priority: 1 },
  select: { pattern: 24, priority: 1 },
  pair: { pattern: 24, priority: 2 },
  undo: { pattern: [14, 22, 20], priority: 2 },
  hint: { pattern: [16, 20, 18], priority: 2 },
  reject: { pattern: [18, 24, 18], priority: 2 },
  land: { pattern: 10, priority: 0 },
  full: { pattern: [26, 64, 30, 46, 18], priority: 3, hold: 240 },
  win: { pattern: [34, 45, 42, 55, 62], priority: 4, hold: 300 },
};
export function setHapticState(on: boolean, paused: boolean, refresh = false) {
  if (enabled === on && blocked === paused && epoch && !refresh) return;
  enabled = on;
  blocked = paused;
  epoch = Math.max(Date.now(), epoch + 1);
  protectedUntil = 0;
  last = -Infinity;
  lastPriority = 0;
  const revision = epoch;
  if (android)
    configured = native
      .configure({ enabled: on && !paused, epoch: revision })
      .catch(() => {});
  else if (!on || paused) {
    try {
      navigator.vibrate?.(0);
    } catch {
      /* Optional feedback. */
    }
  }
}
export async function haptic(cue: HapticCue = "pair") {
  if (!enabled || blocked || document.hidden) return;
  const now = performance.now(),
    p = profiles[cue],
    gap = cue === "land" ? 90 : 70;
  if (now < protectedUntil && p.priority < 3) return;
  if (
    now - last < gap &&
    !(p.priority > lastPriority && (p.priority >= 3 || now - last >= 18))
  )
    return;
  last = now;
  lastPriority = p.priority;
  if (p.hold) protectedUntil = now + p.hold;
  const revision = epoch,
    issuedAt = Date.now();
  if (android) {
    await configured;
    if (
      epoch !== revision ||
      !enabled ||
      blocked ||
      document.hidden ||
      Date.now() - issuedAt > 350
    )
      return;
    await native.pulse({ cue, issuedAt, epoch: revision });
  } else if (Capacitor.isNativePlatform()) {
    const { Haptics, ImpactStyle, NotificationType } =
      await import("@capacitor/haptics");
    if (
      epoch !== revision ||
      blocked ||
      !enabled ||
      Date.now() - issuedAt > 350
    )
      return;
    if (cue === "win" || cue === "full")
      await Haptics.notification({ type: NotificationType.Success });
    else
      await Haptics.impact({
        style: cue === "pair" ? ImpactStyle.Medium : ImpactStyle.Light,
      });
  } else {
    try {
      navigator.vibrate?.(p.pattern);
    } catch {
      /* Browser fallback is not native evidence. */
    }
  }
}
