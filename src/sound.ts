let context: AudioContext | undefined;
let voices = 0,
  lastSelection = 0;
export function suspendSound() {
  void context?.suspend();
}
export function playSound(
  kind: "select" | "pair" | "land" | "milestone" | "full",
  enabled: boolean,
) {
  if (!enabled || document.hidden || voices >= 6) return;
  if (kind === "select" && performance.now() - lastSelection < 45) return;
  if (kind === "select") lastSelection = performance.now();
  try {
    context ??= new AudioContext();
    void context.resume();
    const now = context.currentTime;
    const base = {
      select: 420,
      pair: 260,
      land: 570,
      milestone: 680,
      full: 820,
    }[kind];
    const duration = {
      select: 0.035,
      pair: 0.1,
      land: 0.055,
      milestone: 0.15,
      full: 0.28,
    }[kind];
    const tone = context.createOscillator(),
      gain = context.createGain();
    tone.type = kind === "land" ? "triangle" : "sine";
    const pitch = base * (0.94 + Math.random() * 0.12);
    tone.frequency.setValueAtTime(pitch, now);
    tone.frequency.exponentialRampToValueAtTime(
      pitch * (kind === "full" ? 1.5 : 0.68),
      now + duration,
    );
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(
      kind === "select" ? 0.012 : 0.025,
      now + 0.006,
    );
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    tone.connect(gain);
    gain.connect(context.destination);
    voices++;
    tone.onended = () => {
      voices--;
      tone.disconnect();
      gain.disconnect();
    };
    tone.start(now);
    tone.stop(now + duration);
  } catch {
    /* Optional feedback must never block a move. */
  }
}
