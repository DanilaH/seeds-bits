"""Build the local sound bank from Kenney Casino Audio CC0 OGG sources."""
import argparse
import hashlib
import json
import subprocess
from pathlib import Path

import numpy as np
from scipy.signal import butter, sosfilt

RATE = 44100
ROOT = Path(__file__).resolve().parents[1]
# Each cue uses clean, isolated chip transients. Longer cues place distinct taps.
SCORE = {
    'select': (.22, [[('chip-lay-1', 0)], [('chip-lay-2', 0)], [('chip-lay-3', 0)]]),
    'button': (.20, [[('chip-lay-2', 0)]]),
    'pair': (.40, [[('chips-collide-1', 0)], [('chips-stack-1', 0)], [('chips-stack-2', 0)]]),
    'reject-value': (.21, [[('chip-lay-3', 0)]]),
    'blocked': (.25, [[('chip-lay-3', 0), ('chip-lay-2', .065)]]),
    'long-pair': (.40, [[('chip-lay-1', 0), ('chips-stack-1', .045)], [('chip-lay-2', 0), ('chips-stack-2', .045)]]),
    'row-clear': (.43, [[('chips-stack-2', 0), ('chip-lay-1', .065)], [('chips-stack-1', 0), ('chip-lay-2', .065)]]),
    'multi-row': (.44, [[('chip-lay-2', 0), ('chips-stack-1', .06), ('chips-collide-1', .125)]]),
    'add': (.31, [[('chip-lay-1', 0), ('chip-lay-2', .065), ('chip-lay-3', .13)]]),
    'undo': (.29, [[('chip-lay-3', 0), ('chip-lay-1', .065)]]),
    'hint': (.26, [[('chip-lay-1', 0)], [('chip-lay-2', 0)], [('chip-lay-3', 0)]]),
    'plan-step': (.28, [[('chip-lay-1', 0)], [('chip-lay-2', 0)], [('chip-lay-3', 0)]]),
    'deal': (.27, [[('chip-lay-1', 0), ('chip-lay-2', .065), ('chip-lay-3', .13)]]),
    'land': (.16, [[('chip-lay-1', 0)], [('chip-lay-2', 0)]]),
    'task': (.42, [[('chip-lay-2', 0), ('chips-stack-1', .11)]]),
    'page': (.44, [[('chip-lay-1', 0), ('chips-stack-1', .10), ('chips-stack-2', .23)]]),
    'book': (.46, [[('chip-lay-1', 0), ('chips-stack-2', .11), ('chips-stack-1', .24), ('chips-collide-1', .39)]]),
    'full': (.42, [[('chips-stack-1', 0), ('chips-stack-2', .11), ('chips-collide-1', .24)]]),
    'win': (.46, [[('chip-lay-2', 0), ('chips-stack-2', .11), ('chips-stack-1', .24), ('chips-collide-1', .39)]]),
}


def samples(seconds):
    return round(seconds * RATE)


def load_clip(path):
    data = subprocess.check_output(['ffmpeg', '-v', 'error', '-i', str(path),
                                    '-ac', '1', '-ar', str(RATE), '-f', 'f32le', '-'])
    raw = np.frombuffer(data, dtype='<f4').astype(float)
    active = np.flatnonzero(np.abs(raw) > .015)
    start = max(0, active[0] - samples(.003))
    end = min(len(raw), active[-1] + samples(.022))
    raw = raw[start:end]
    # Retain the tap's body while attenuating sub-bass and sharp upper harmonics.
    filtered = sosfilt(butter(2, (90, 6500), 'bandpass', fs=RATE, output='sos'), raw)
    filtered[:samples(.001)] *= np.linspace(0, 1, samples(.001))
    filtered[-samples(.014):] *= np.linspace(1, 0, samples(.014))
    return filtered / np.max(np.abs(filtered))


def encode(path, data, codec, quality):
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(RATE),
                    '-ac', '1', '-i', '-', '-c:a', codec, '-q:a', quality, str(path)],
                   input=np.asarray(data, dtype='<f4').tobytes(), check=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('sources', type=Path)
    parser.add_argument('--audition', type=Path)
    args = parser.parse_args()
    names = sorted({name for _, variations in SCORE.values() for layers in variations for name, _ in layers})
    clips = {name: load_clip(args.sources / (name + '.ogg')) for name in names}
    bank, slices, cues = [np.zeros(samples(.04))], {}, {}
    cursor = len(bank[0])
    for cue, (peak, variations) in SCORE.items():
        slices[cue], cues[cue] = [], []
        for layers in variations:
            sound = np.zeros(max(samples(at) + len(clips[name]) for name, at in layers))
            for name, at in layers:
                start = samples(at)
                sound[start:start + len(clips[name])] += clips[name]
            sound *= peak / np.max(np.abs(sound))
            slices[cue].append([cursor / RATE, len(sound) / RATE])
            cues[cue].append(sound)
            bank.extend((sound, np.zeros(samples(.04))))
            cursor += len(sound) + samples(.04)
    destination = ROOT / 'src' / 'audio'
    encode(destination / 'seeds-foley.ogg', np.concatenate(bank), 'libvorbis', '6')
    (destination / 'foley-slices.json').write_text(json.dumps(slices, separators=(',', ':')) + '\n')
    if args.audition:
        track = np.zeros(samples(8))
        for index, cue in enumerate(['select', 'pair', 'pair', 'blocked', 'long-pair', 'row-clear', 'undo', 'add', 'multi-row', 'win']):
            start = samples(.25 + index * .65)
            sound = cues[cue][index % len(cues[cue])] * .43
            track[start:start + len(sound)] += sound
        encode(args.audition, track, 'pcm_s16le', '0')
    print(json.dumps({name: hashlib.sha256((args.sources / (name + '.ogg')).read_bytes()).hexdigest() for name in names}, indent=2))


if __name__ == '__main__':
    main()
