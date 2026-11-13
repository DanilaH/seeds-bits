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
  kind:
    | "select"
    | "button"
    | "pair"
    | "land"
    | "milestone"
    | "full"
    | "undo"
    | "hint"
    | "add"
    | "win"
    | "task"
    | "page"
    | "book",
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
      base = {
        select: 420,
        button: 360,
        pair: 260,
        land: 570,
        milestone: 680,
        full: 820,
        undo: 330,
        hint: 520,
        add: 390,
        task: 440,
        page: 520,
        book: 440,
        win: 440,
      }[kind];
    const duration = {
      select: 0.035,
      button: 0.028,
      undo: 0.065,
      hint: 0.09,
      add: 0.08,
      task: 0.16,
      page: 0.32,
      book: 0.48,
      win: 0.24,
      pair: 0.1,
      land: 0.055,
      milestone: 0.15,
      full: 0.28,
    }[kind];
    tone = context.createOscillator();
    gain = context.createGain();
    tone.type = kind === "land" || kind === "win" ? "triangle" : "sine";
    const pitch = base * (0.94 + Math.random() * 0.12);
    tone.frequency.setValueAtTime(pitch, now);
    tone.frequency.exponentialRampToValueAtTime(
      pitch * (kind === "full" ? 1.5 : 0.68),
      now + duration,
    );
    if (["task", "page", "book"].includes(kind)) {
      const notes =
        kind === "task"
          ? [440, 554.37]
          : kind === "page"
            ? [523.25, 659.25, 783.99]
            : [440, 554.37, 659.25, 880];
      notes.forEach((note, i) =>
        tone!.frequency.setValueAtTime(
          note,
          now + (i * duration) / notes.length,
        ),
      );
    }
    if (kind === "win") {
      tone.frequency.setValueAtTime(440, now);
      tone.frequency.setValueAtTime(554.37, now + 0.075);
      tone.frequency.setValueAtTime(659.25, now + 0.15);
    }
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(
      kind === "select" || kind === "button" ? 0.012 : 0.025,
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
