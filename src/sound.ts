import { coreFeelPilot, feelSoundPack } from "./feel-pilot";
import type { FeelCue } from "./feel-audio";

let context: AudioContext | undefined;
let blocked = false,
  lastSelection = 0;
const active = new Set<() => void>();
const pilotVoices = new Map<() => void, number>();
let pilotAudio: typeof import("./feel-audio") | undefined;
let loadingPilot: Promise<void> | undefined;
let lastPilotLand = -Infinity;
let lastPilotAccent = -Infinity;

export function warmPilotSound() {
  if (!coreFeelPilot || !feelSoundPack() || typeof AudioContext === "undefined") return;
  try {
    context ??= new AudioContext();
    if (!loadingPilot) loadingPilot = import("./feel-audio").then(audio => { pilotAudio = audio; });
    void loadingPilot.then(() => {
      const pack = feelSoundPack();
      if (pack && context) pilotAudio?.primeFeelAudio(context, pack);
    }).catch(() => {});
  } catch {
    // Optional feedback can be unavailable on the host.
  }
}

function playPilot(cue: FeelCue) {
  const pack = feelSoundPack();
  if (!pack) return;
  try {
    if (!context || context.state === "closed") context = new AudioContext();
    const audioContext = context;
    void audioContext.resume().catch(() => {});
    warmPilotSound();
    const now = performance.now();
    const accent = ["task", "page", "book", "win", "full"].includes(cue);
    const priority = accent ? 3 : cue === "land" ? 0 : ["select", "button", "hint"].includes(cue) ? 1 : 2;
    if (priority < 3 && now - lastPilotAccent < (priority === 0 ? 310 : 92)) return;
    if (cue === "land" && (now - lastPilotLand < 125 || [...pilotVoices.values()].some(value => value >= 2))) return;
    const voice = pilotAudio?.feelVoice(audioContext, pack, cue);
    if (!voice) return;
    if (priority >= 2) {
      for (const [release, oldPriority] of pilotVoices)
        if (oldPriority === 0 || (accent && oldPriority < 3)) release();
    }
    if (pilotVoices.size >= 3) {
      const lower = [...pilotVoices].find(([, oldPriority]) => oldPriority < priority);
      if (!lower) return;
      lower[0]();
    }
    if (cue === "land") lastPilotLand = now;
    if (accent) lastPilotAccent = now;
    const { source, start, duration } = voice;
    const gain = audioContext.createGain();
    gain.gain.value = .38;
    const release = () => {
      if (!active.delete(release)) return;
      pilotVoices.delete(release);
      try { source.stop(); } catch {}
      source.disconnect();
      gain.disconnect();
    };
    source.connect(gain);
    gain.connect(audioContext.destination);
    active.add(release);
    pilotVoices.set(release, priority);
    source.onended = release;
    try { source.start(0, start, duration); } catch { release(); }
  } catch {
    // Feedback should never affect gameplay.
  }
}
export function blockSound(value: boolean) {
  blocked = value;
  if (value) suspendSound();
}
export function suspendSound() {
  for (const release of [...active]) release();
  lastPilotLand = lastPilotAccent = -Infinity;
  void context?.suspend().catch(() => {});
}
export type SoundCue = FeelCue | "magnet" | "plan-step" | "shuffle" | "milestone";
export function playSound(
  kind: SoundCue,
  enabled: boolean,
  stage = 0,
) {
  if (blocked || !enabled || document.hidden) return;
  if (kind === "select" && performance.now() - lastSelection < 45) return;
  if (kind === "select") lastSelection = performance.now();
  if (coreFeelPilot && feelSoundPack() && kind !== "magnet" && kind !== "plan-step" && kind !== "shuffle") {
    playPilot(kind === "milestone" ? "full" : kind);
    return;
  }
  if (kind === "deal" || kind === "reject-value" || kind === "blocked" || kind === "long-pair" ||
    kind === "row-clear" || kind === "multi-row") return;
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
        magnet: 440,
        "plan-step": 440 * 2 ** ((Math.min(2, Math.max(0, stage)) * 2) / 12),
        shuffle: 350,
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
      magnet: 0.17,
      "plan-step": 0.085,
      shuffle: 0.19,
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
    const pitch =
      base * (kind === "plan-step" ? 1 : 0.94 + Math.random() * 0.12);
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
