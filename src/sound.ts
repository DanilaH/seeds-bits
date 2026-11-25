import slices from "./audio/foley-slices.json";

type RecordedCue = keyof typeof slices;
export type SoundCue = RecordedCue | "magnet" | "shuffle" | "milestone";

const bankUrl = new URL("./audio/seeds-foley.ogg", import.meta.url);
const variants = new Map<RecordedCue, number>();
const active = new Map<() => void, number>();
const aliases = {magnet: "long-pair", shuffle: "add", milestone: "full"} as const;
let context: AudioContext | undefined;
let bank: AudioBuffer | undefined;
let loading: Promise<void> | undefined;
let blocked = false;
let lastSelection = -Infinity;
let lastLand = -Infinity;
let lastAccent = -Infinity;

export function warmSound(): Promise<void> | undefined {
  try {
    if (!context || context.state === "closed") {
      for (const stop of active.keys()) stop();
      context = new AudioContext();
      bank = undefined;
      loading = undefined;
    }
    const current = context;
    loading ??= fetch(bankUrl)
      .then(response => {
        if (!response.ok) throw new Error("Sound bank unavailable");
        return response.arrayBuffer();
      })
      .then(bytes => current.decodeAudioData(bytes))
      .then(buffer => { if (context === current) bank = buffer; })
      .catch(() => { /* Optional sound cannot interrupt play. */ });
    return loading;
  } catch {
    // AudioContext may be unavailable.
  }
}

export function blockSound(value: boolean) {
  blocked = value;
  if (value) suspendSound();
}

export function suspendSound() {
  for (const stop of active.keys()) stop();
  lastSelection = lastLand = lastAccent = -Infinity;
  void context?.suspend().catch(() => {});
}

export function playSound(kind: SoundCue, enabled: boolean, stage?: number) {
  if (blocked || !enabled || document.hidden) return;
  const cue = kind in aliases ? aliases[kind as keyof typeof aliases] : kind as RecordedCue;
  const now = performance.now();
  const accent = ["task", "page", "book", "win", "full"].includes(cue);
  const priority = accent || cue === "plan-step" ? 3 :
    cue === "land" ? 0 : ["select", "button", "hint"].includes(cue) ? 1 : 2;
  if (cue === "select" && now - lastSelection < 45) return;
  if (!accent && now - lastAccent < (priority === 0 ? 310 : 92)) return;
  if (cue === "land" && (now - lastLand < 125 || [...active.values()].some(value => value >= 2))) return;

  try {
    void warmSound();
    if (!context) return;
    void context.resume().catch(() => {});
    if (!bank) return; // Never replay a tap later, after the bank has decoded.

    if (priority >= 2) {
      for (const [stop, oldPriority] of active)
        if (oldPriority === 0 || (accent && oldPriority < 3)) stop();
    }
    if (active.size >= 3) {
      const lower = [...active].find(([, oldPriority]) => oldPriority < priority);
      if (!lower) return;
      lower[0]();
    }

    const options = slices[cue];
    const index = Math.max(0, stage ?? variants.get(cue) ?? 0) % options.length;
    const [start, duration] = options[index];
    variants.set(cue, (index + 1) % options.length);
    const source = context.createBufferSource();
    source.buffer = bank;
    const gain = context.createGain();
    gain.gain.value = .43;
    const release = () => {
      if (!active.delete(release)) return;
      try { source.stop(); } catch {}
      source.disconnect();
      gain.disconnect();
    };
    source.connect(gain);
    gain.connect(context.destination);
    active.set(release, priority);
    source.onended = release;
    try {
      source.start(0, start, duration);
      if (cue === "select") lastSelection = now;
      if (cue === "land") lastLand = now;
      if (accent) lastAccent = now;
    } catch {
      release();
    }
  } catch {
    // Audio feedback cannot affect input or persistence.
  }
}
