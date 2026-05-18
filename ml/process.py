"""
Rogue FM — recording processor (Phase 2 baseline).

Uses inaSpeechSegmenter (built for broadcast audio) to segment a recording
into music / speech / noise. Sung vocals stay "music" — unlike a raw VAD.

Mapping to our segment model:
    music    -> "music"
    speech   -> "unknown"   (subtype dj/ad/jingle comes in Phase 3)
    noise    -> "unknown"   (jingles/effects — needs manual review)
    noEnergy -> absorbed into the previous segment (silence/dead air)

stdout: pure JSON  -> consumed by the Next API route
stderr: human logs  -> ignored by the caller

Usage:
    uv run python process.py --file ../storage/recordings/"Radio X.mp3" --id <recordingId>
"""

import argparse
import json
import os
import sys

# Quiet noisy libs and keep stdout pristine for the JSON contract.
os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "3")
os.environ.setdefault("TRANSFORMERS_NO_ADVISORY_WARNINGS", "1")
os.environ.setdefault("TQDM_DISABLE", "1")

# inaSpeechSegmenter / TF / tqdm can print to stdout. Redirect Python-level
# stdout to stderr for the whole run; the only thing allowed on real stdout
# is the final JSON payload, written through _REAL_STDOUT.
_REAL_STDOUT = sys.stdout
sys.stdout = sys.stderr

LABEL_MAP = {
    "music": "music",
    "speech": "unknown",
    "noise": "unknown",
    "noEnergy": None,  # absorb into previous segment
}


def log(*a):
    print(*a, file=sys.stderr, flush=True)


def smooth(segments: list[dict], min_seg_sec: float) -> list[dict]:
    """
    Collapse flicker at track/talk boundaries: any segment shorter than
    min_seg_sec is absorbed into the preceding segment, then adjacent
    same-type runs are re-merged.
    """
    if not segments:
        return segments

    out: list[dict] = []
    for seg in segments:
        dur = seg["endSec"] - seg["startSec"]
        if out and dur < min_seg_sec:
            # absorb the short blip into whatever came before it
            out[-1]["endSec"] = seg["endSec"]
            continue
        if out and out[-1]["type"] == seg["type"]:
            out[-1]["endSec"] = seg["endSec"]
            continue
        out.append(dict(seg))

    # second pass: re-merge same-type neighbours created by absorption
    merged: list[dict] = []
    for seg in out:
        if merged and merged[-1]["type"] == seg["type"]:
            merged[-1]["endSec"] = seg["endSec"]
        else:
            merged.append(seg)
    return merged


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--file", required=True)
    parser.add_argument("--id", required=True)
    parser.add_argument(
        "--min-seg-sec",
        type=float,
        default=4.0,
        help="segments shorter than this are merged into the previous one",
    )
    args = parser.parse_args()

    log(f"[process] segmenting: {args.file}")
    from inaSpeechSegmenter import Segmenter

    seg = Segmenter(vad_engine="smn", detect_gender=False)
    raw = seg(args.file)  # list of (label, start_sec, end_sec)
    log(f"[process] raw segments: {len(raw)}")

    segments: list[dict] = []
    for label, start, end in raw:
        start = float(start)
        end = float(end)
        if end <= start:
            continue
        mapped = LABEL_MAP.get(label, "unknown")

        if mapped is None:
            # silence / dead air: extend previous segment over it
            if segments:
                segments[-1]["endSec"] = round(end, 3)
            continue

        if segments and segments[-1]["type"] == mapped:
            # merge adjacent same-type runs
            segments[-1]["endSec"] = round(end, 3)
        else:
            segments.append(
                {
                    "startSec": round(start, 3),
                    "endSec": round(end, 3),
                    "type": mapped,
                    "confidence": 1.0,
                }
            )

    before = len(segments)
    segments = smooth(segments, args.min_seg_sec)
    log(f"[process] smoothed {before} -> {len(segments)} segments "
        f"(min_seg_sec={args.min_seg_sec})")

    if not segments:
        log("[process] no segments produced")
        json.dump(
            {"id": args.id, "duration": 0.0, "segments": []}, _REAL_STDOUT
        )
        _REAL_STDOUT.flush()
        return 0

    duration = segments[-1]["endSec"]
    music_n = sum(1 for s in segments if s["type"] == "music")
    other_n = len(segments) - music_n
    log(f"[process] result: {music_n} music, {other_n} speech/other")

    json.dump(
        {"id": args.id, "duration": round(duration, 3), "segments": segments},
        _REAL_STDOUT,
    )
    _REAL_STDOUT.flush()
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as e:  # noqa: BLE001
        log(f"[process] FAILED: {e}")
        json.dump({"error": str(e)}, _REAL_STDOUT)
        _REAL_STDOUT.flush()
        sys.exit(1)
