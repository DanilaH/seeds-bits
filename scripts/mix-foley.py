"""Build the offline sound bank from the CC0 recordings in docs/CORE_FEEL_PILOT.md."""
import argparse
import json
import subprocess
from pathlib import Path

import numpy as np
from scipy.signal import butter, sosfilt

RATE = 32000
ROOT = Path(__file__).resolve().parents[1]

# Source, start/end (seconds), and low-pass for individual pieces of foley.
TAKES = {
    "touch-a": ("wood", 57.847, 57.944, 2600),
    "touch-b": ("wood", 58.048, 58.149, 2400),
    "touch-c": ("wood", 40.934, 41.029, 2300),
    "piece-a": ("wood", 38.306, 38.438, 2850),
    "piece-b": ("wood", 30.252, 30.393, 2700),
    "piece-c": ("wood", 39.270, 39.411, 2650),
    "knuckle-a": ("knock", 22.407, 22.527, 1950),
    "knuckle-b": ("knock", 22.590, 22.718, 1720),
    "knuckle-c": ("knock", 24.369, 24.488, 1580),
    "paper-a": ("paper", .536, .693, 2950),
    "paper-b": ("paper", 4.117, 4.282, 2900),
    "paper-c": ("paper", 4.594, 4.832, 2700),
    "paper-d": ("paper", .888, 1.035, 2350),
    "glass-a": ("seeds", .060, .124, 1650),
    "glass-b": ("seeds", .188, .255, 1570),
    "glass-pour": ("seeds", .050, .451, 1800),
    "scatter": ("wood", 38.511, 38.887, 2650),
}

# Peak before the app's master gain, followed by variants. Each layer has a
# source, placement and relative level. Times are editorial positions only.
SCORE = {
    "select": (.100, [[("touch-a", 0, 1)], [("touch-b", 0, 1)], [("touch-c", 0, 1)]]),
    "button": (.095, [[("touch-c", 0, 1)]]),
    "pair": (.225, [[("piece-a", 0, 1)], [("piece-b", 0, 1)], [("piece-c", 0, 1)]]),
    "reject-value": (.112, [[("knuckle-c", 0, 1)]]),
    "blocked": (.145, [[("paper-d", 0, .29), ("knuckle-b", .036, 1)]]),
    "long-pair": (.216, [[("piece-b", 0, 1), ("paper-a", .022, .24)],
                          [("piece-a", 0, 1), ("paper-b", .025, .24)]]),
    "row-clear": (.255, [[("piece-c", 0, .92), ("paper-a", .019, .63)],
                          [("piece-b", 0, .92), ("paper-b", .019, .63)]]),
    "multi-row": (.268, [[("piece-a", 0, .82), ("paper-c", .014, .58), ("knuckle-a", .064, .52)]]),
    "add": (.181, [[("scatter", 0, .8), ("paper-a", .021, .59)]]),
    "undo": (.152, [[("paper-d", 0, .51), ("touch-b", .044, .85)]]),
    "hint": (.119, [[("touch-a", 0, 1)], [("touch-b", 0, 1)], [("touch-c", 0, 1)]]),
    "plan-step": (.122, [[("touch-c", 0, 1)], [("touch-b", 0, 1)], [("touch-a", 0, 1)]]),
    "deal": (.147, [[("scatter", 0, .84), ("paper-b", .013, .52)]]),
    "land": (.072, [[("glass-a", 0, 1)], [("glass-b", 0, 1)]]),
    "task": (.285, [[("piece-a", 0, .95), ("glass-pour", .042, .72)]]),
    "page": (.298, [[("paper-c", 0, .85), ("piece-c", .045, .71), ("glass-pour", .099, .65)]]),
    "book": (.315, [[("paper-b", 0, .53), ("paper-c", .083, .64), ("glass-pour", .143, .88)]]),
    "full": (.285, [[("glass-pour", 0, 1), ("piece-b", .038, .31)]]),
    "win": (.300, [[("piece-b", 0, .83), ("glass-pour", .045, .84)]]),
}


def samples(seconds):
    return round(seconds * RATE)


def read_sources(source_dir):
    sources = {}
    for name, *_ in TAKES.values():
        if name in sources:
            continue
        source = source_dir / f"{name}.mp3"
        decoded = subprocess.check_output([
            "ffmpeg", "-v", "error", "-i", str(source), "-ac", "1", "-ar", str(RATE),
            "-f", "s16le", "-",
        ])
        sources[name] = np.frombuffer(decoded, dtype="<i2").astype(float) / 32768
    return sources


def prepare(sources, description):
    source, start, end, lowpass = description
    raw = sources[source][samples(start):samples(end)]
    if len(raw) != samples(end) - samples(start):
        raise ValueError(f"Recording {source} ends before {end}s")
    order = 4 if source == "seeds" else 2
    filtered = sosfilt(butter(order, (105, lowpass), "bandpass", fs=RATE, output="sos"), raw)
    attack, release = samples(.004), samples(.025)
    filtered[:attack] *= np.linspace(0, 1, attack)
    filtered[-release:] *= np.linspace(1, 0, release)
    return filtered / np.max(np.abs(filtered))


def mix(layers, clips, peak):
    mixdown = np.zeros(max(samples(at) + len(clips[name]) for name, at, _ in layers))
    for name, at, weight in layers:
        clip = clips[name]
        start = samples(at)
        mixdown[start:start + len(clip)] += clip * weight
    return mixdown * (peak / np.max(np.abs(mixdown)))


def write_audio(path, track, codec, quality):
    subprocess.run([
        "ffmpeg", "-v", "error", "-y", "-f", "s16le", "-ar", str(RATE), "-ac", "1",
        "-i", "-", "-c:a", codec, "-b:a", quality, str(path),
    ], input=(np.clip(track, -1, 1) * 32767).astype("<i2").tobytes(), check=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("sources", type=Path, help="directory with the four named source MP3s")
    parser.add_argument("--audition", type=Path, help="write a representative sequence of moves")
    args = parser.parse_args()
    sources = read_sources(args.sources)
    clips = {name: prepare(sources, description) for name, description in TAKES.items()}
    bank, slices, cues = [np.zeros(samples(.055))], {}, {}
    cursor = len(bank[0])
    for cue, (peak, variations) in SCORE.items():
        slices[cue], cues[cue] = [], []
        for layers in variations:
            sound = mix(layers, clips, peak)
            pad = np.zeros(samples(.040))
            bank.extend((sound, pad))
            slices[cue].append([cursor / RATE, len(sound) / RATE])
            cues[cue].append(sound)
            cursor += len(sound) + len(pad)
    dest = ROOT / "src" / "audio"
    dest.mkdir(exist_ok=True)
    write_audio(dest / "seeds-foley.ogg", np.concatenate(bank), "libopus", "48k")
    (dest / "foley-slices.json").write_text(json.dumps(slices, separators=(",", ":")) + "\n")
    if args.audition:
        score = ["pair", "pair", "blocked", "long-pair", "row-clear", "undo",
                 "pair", "add", "pair", "multi-row", "long-pair", "win"]
        run = np.zeros(samples(7.6))
        at = .2
        for i, cue in enumerate(score):
            if cue not in {"add", "undo"}:
                select = cues["select"][i % 3]
                start = samples(at)
                run[start:start + len(select)] += select
            sound = cues[cue][i % len(cues[cue])]
            start = samples(at + .12)
            run[start:start + len(sound)] += sound
            at += (.30, .42, .54, .38)[i % 4]
        write_audio(args.audition, run[:samples(at + .7)] * .43, "libmp3lame", "96k")


if __name__ == "__main__":
    main()
