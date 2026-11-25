import slices from "./audio/feel-slices.json";
import type { SoundPack } from "./feel-pilot";

export type FeelCue = keyof typeof slices.pop;
const banks = new WeakMap<AudioContext, Map<SoundPack, AudioBuffer | Promise<void>>>();
const variations = new Map<FeelCue, number>();

export function primeFeelAudio(context: AudioContext, pack: SoundPack) {
  const cached = banks.get(context) ?? new Map();
  banks.set(context, cached);
  if (cached.has(pack)) return;
  const url = pack === "dry"
    ? new URL("./audio/feel-dry.ogg", import.meta.url)
    : new URL("./audio/feel-pop.ogg", import.meta.url);
  cached.set(pack, fetch(url)
    .then(response => {
      if (!response.ok) throw new Error("Audio bank unavailable");
      return response.arrayBuffer();
    })
    .then(data => context.decodeAudioData(data))
    .then(data => { cached.set(pack, data); })
    .catch(() => {
      // Broken or unsupported audio must never interrupt a move or queue cues.
    }));
}

export function feelVoice(context: AudioContext, pack: SoundPack, cue: FeelCue) {
  const buffer = banks.get(context)?.get(pack);
  if (!(buffer instanceof AudioBuffer)) return;
  const options = slices[pack][cue];
  const index = variations.get(cue) ?? 0;
  const [start, duration] = options[index];
  variations.set(cue, (index + 1) % options.length);
  const source = context.createBufferSource();
  source.buffer = buffer;
  return { source, start, duration };
}
