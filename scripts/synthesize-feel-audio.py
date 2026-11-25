"""Render the two original Core Feel banks and listening comparisons."""
import argparse
import json
import subprocess
from pathlib import Path

import numpy as np
from scipy.signal import butter, sosfilt

RATE = 32_000
ROOT = Path(__file__).resolve().parents[1]

# Event score: onset in seconds, weight, resonator scale, texture.
SCORES = {
    "button": (0.21, [(0, .7, .94, "tap")]),
    "select": (0.29, [(0, .8, 1.22, "tap")]),
    "pair": (0.49, [(0, 1, .94, "hit"), (.028, .34, 1.34, "tap")]),
    "reject-value": (0.33, [(0, .64, .73, "damp"), (.036, .23, .52, "damp")]),
    "blocked": (0.39, [(0, .28, .92, "brush"), (.044, .92, .62, "damp")]),
    "long-pair": (0.51, [(0, .21, 1.08, "brush"), (.028, .28, 1.22, "tap"), (.057, .85, .88, "hit")]),
    "row-clear": (0.63, [(0, .30, 1.12, "brush"), (.024, .98, .77, "hit"), (.068, .28, 1.46, "tap")]),
    "multi-row": (0.75, [(0, .35, 1.17, "brush"), (.027, .8, .74, "hit"), (.081, 1, .64, "hit"), (.125, .23, 1.30, "tap")]),
    "add": (0.48, [(0, .45, .90, "brush"), (.028, .42, 1.00, "tap"), (.058, .62, 1.12, "tap"), (.084, .66, 1.24, "tap")]),
    "undo": (0.47, [(0, .5, .80, "lift"), (.045, .73, 1.14, "tap")]),
    "hint": (0.25, [(0, .49, 1.42, "tap"), (.042, .30, 1.75, "tap")]),
    "deal": (0.44, [(0, .40, .95, "brush"), (.032, .34, 1.04, "tap"), (.063, .53, 1.16, "tap"), (.092, .63, 1.28, "tap")]),
    "land": (0.15, [(0, .44, 1.16, "damp")]),
    "task": (0.66, [(0, .90, .87, "hit"), (.073, .69, 1.16, "chime"), (.126, .54, 1.46, "chime")]),
    "page": (0.76, [(0, .48, .87, "brush"), (.058, .82, .88, "hit"), (.116, .72, 1.17, "chime"), (.18, .62, 1.48, "chime")]),
    "book": (0.88, [(0, .62, .76, "hit"), (.065, .80, .97, "chime"), (.122, .69, 1.29, "chime"), (.182, .63, 1.54, "chime"), (.238, .48, 1.93, "chime")]),
    "full": (0.79, [(0, .79, .62, "hit"), (.039, .48, 1.04, "tap"), (.079, .59, 1.47, "chime"), (.145, .39, 1.96, "chime")]),
    "win": (0.72, [(0, .91, .78, "hit"), (.074, .72, 1.05, "chime"), (.128, .61, 1.31, "chime"), (.181, .50, 1.57, "chime")]),
}
VARIANTS = {"select", "pair", "long-pair", "row-clear", "reject-value", "blocked", "land"}
DEMO = [
    "pair", "pair", "long-pair", "pair", "row-clear", "pair", "undo", "pair",
    "multi-row", "add", "long-pair", "win",
]
PEAK = {
    "button": .32, "select": .39, "reject-value": .42, "blocked": .47,
    "hint": .43, "deal": .47, "land": .22, "pair": .66, "long-pair": .72,
    "row-clear": .79, "multi-row": .83, "add": .58, "undo": .59,
    "task": .84, "page": .87, "book": .9, "full": .84, "win": .86,
}


def strike(t, pitch, texture, pop, rng):
    noise = rng.standard_normal(len(t))
    band = (250, 2500) if pop else (580, 6500)
    noise = sosfilt(butter(2, band, btype="bandpass", fs=RATE, output="sos"), noise)
    attack = 1 - np.exp(-t / (.0018 if pop else .00065))
    if texture == "brush":
        grain = (1 - np.exp(-t / .006)) * np.exp(-t / (.018 if pop else .023))
        return noise * grain * (0.72 + 0.28 * np.cos(2 * np.pi * 61 * t))
    if texture == "lift":
        return np.roll(strike(t, pitch, "brush", pop, rng)[::-1], int(.058 * RATE))
    if pop:
        modes = (382, 671, 1259, 2480)
        weights = (1, .33, .13, .07)
        bend = 0.22 * .013 * (1 - np.exp(-t / .013))
        tails = (.032, .017, .012, .006)
    else:
        modes = (718, 1192, 2064, 3670)
        weights = (.62, 1, .42, .14)
        bend = .024 * .008 * (1 - np.exp(-t / .008))
        tails = (.012, .009, .0065, .0046)
    if texture == "damp":
        tails = tuple(d * .49 for d in tails)
        weights = tuple(w * (.55 ** i) for i, w in enumerate(weights))
    if texture == "chime":
        modes = (440, 897, 1461, 2308) if pop else (504, 1026, 1632, 2419)
        weights = (.88, .22, .13, .09)
        tails = (.062, .034, .018, .008)
        bend *= .1
    if texture == "tap":
        tails = tuple(d * .57 for d in tails)
    body = sum(
        weight * np.sin(2 * np.pi * f * pitch * (t + bend) + rng.uniform(-.5, .5))
        * np.exp(-t / duration)
        for f, weight, duration in zip(modes, weights, tails)
    )
    tick = noise * np.exp(-t / (.0055 if pop else .009))
    return attack * (body + tick * (.28 if pop else .83))


def render(kind, variant, pop, rng):
    length, score = SCORES[kind]
    sound = np.zeros(round(length * RATE))
    for onset, weight, pitch, texture in score:
        start = round(onset * RATE)
        t = np.arange(len(sound) - start) / RATE
        pitch *= (0.975, 1.035)[variant] * rng.uniform(.985, 1.015)
        sound[start:] += weight * strike(t, pitch, texture, pop, rng)
    sound *= PEAK[kind] / max(abs(sound))
    audible_end = np.flatnonzero(np.abs(sound) > .006)[-1] + 1
    fade = round(.014 * RATE)
    sound = sound[:audible_end + fade]
    sound[-fade:] *= np.linspace(1, 0, fade)
    return sound


def encode(path, data, *options):
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", "-f", "s16le", "-ar", str(RATE),
         "-ac", "1", "-i", "-", *options, str(path)],
        input=(np.clip(data, -1, 1) * 32767).astype("<i2").tobytes(), check=True,
    )


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--listening", type=Path, help="also write audition MP3 files")
    args = parser.parse_args()
    path = ROOT / "src" / "audio"
    path.mkdir(exist_ok=True)
    if args.listening:
        args.listening.mkdir(parents=True, exist_ok=True)
    manifest = {}
    for pack in ("dry", "pop"):
        rng = np.random.default_rng(336033 if pack == "dry" else 336039)
        clips, slices, samples = {}, {}, [np.zeros(round(.05 * RATE))]
        position = len(samples[0])
        for kind in SCORES:
            clips[kind], slices[kind] = [], []
            for variant in range(2 if kind in VARIANTS else 1):
                clip = render(kind, variant, pack == "pop", rng)
                clips[kind].append(clip)
                slices[kind].append([round(position / RATE, 5), len(clip) / RATE])
                padding = np.zeros(round(.04 * RATE))
                samples.extend((clip, padding))
                position += len(clip) + len(padding)
        encode(path / f"feel-{pack}.ogg", np.concatenate(samples),
               "-c:a", "libopus", "-b:a", "48k", "-application", "audio")
        manifest[pack] = slices
        if args.listening:
            singles = ["select", "pair", "reject-value", "blocked", "long-pair", "row-clear",
                       "multi-row", "add", "undo", "hint", "land", "task", "page", "book", "full", "win"]
            audition = np.zeros(round((len(singles) + 1) * RATE))
            for second, kind in enumerate(singles, 1):
                clip = clips[kind][0]
                audition[second * RATE: second * RATE + len(clip)] += .86 * clip
            encode(args.listening / f"seeds-{pack}-single-actions.mp3", audition, "-q:a", "2")
            run = np.zeros(9 * RATE)
            at = .4
            for i, kind in enumerate(DEMO):
                if kind not in ("undo", "add"):
                    sources = [(at, clips["select"][i % 2]), (at + .132, clips[kind][i % len(clips[kind])])]
                else:
                    sources = [(at, clips[kind][0])]
                for start, clip in sources:
                    offset = round(start * RATE)
                    run[offset:offset + len(clip)] += .76 * clip
                at += (.62, .47, .39, .56)[i % 4]
            encode(args.listening / f"seeds-{pack}-12-moves.mp3", run[:round((at + .55) * RATE)],
                   "-q:a", "2")
    (path / "feel-slices.json").write_text(json.dumps(manifest, separators=(",", ":")) + "\n")


if __name__ == "__main__":
    main()
