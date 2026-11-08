let context: AudioContext | undefined;
let blocked = false,
  lastSelection = 0;
const active = new Set<() => void>();
export function blockSound(value: boolean) {
  blocked = value;
  if (value) suspendSound();
}
export function suspendSound() {
  for (const release of [...active]) release();
  void context?.suspend().catch(() => {});
}
export function playSound(
  kind: "select" | "pair" | "land" | "milestone" | "full",
  enabled: boolean,
) {
  if (blocked || !enabled || document.hidden) return;
  if (kind === "select" && performance.now() - lastSelection < 45) return;
  if (kind === "select") lastSelection = performance.now();
  let tone: OscillatorNode | undefined,
    gain: GainNode | undefined,
    released = false;
  const release = () => {
    if (released) return;
    released = true;
    active.delete(release);
    try {
      tone?.stop();
    } catch {}
    tone?.disconnect();
    gain?.disconnect();
  };
  try {
    if (!context || context.state === "closed") context = new AudioContext();
    // Resume must precede the voice cap: suspended nodes cannot finish otherwise.
    void context.resume().catch(() => {});
    if (active.size >= 6) return;
    const now = context.currentTime,
      base = { select: 420, pair: 260, land: 570, milestone: 680, full: 820 }[
        kind
      ];
    const duration = {
      select: 0.035,
      pair: 0.1,
      land: 0.055,
      milestone: 0.15,
      full: 0.28,
    }[kind];
    tone = context.createOscillator();
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
    active.add(release);
    tone.onended = release;
    tone.start(now);
    tone.stop(now + duration);
  } catch {
    release();
  }
}
