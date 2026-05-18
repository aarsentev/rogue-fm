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


def _pulse_clarity(clip, sr):
    """
    How strongly a clip has a periodic musical beat. Autocorrelation peak of
    the onset-strength envelope within a 50–200 BPM lag window, normalised by
    the zero-lag. Music / music-bed => high; talking voice => low.
    Returns None if the clip is too short to judge.
    """
    import librosa
    import numpy as np

    if len(clip) < int(sr * 1.5):
        return None
    oenv = librosa.onset.onset_strength(y=clip, sr=sr)
    if oenv.size < 8 or not np.any(oenv):
        return 0.0
    ac = librosa.autocorrelate(oenv, max_size=oenv.size)
    ac0 = ac[0] if ac[0] > 0 else 1e-9
    hop = 512
    fps = sr / hop
    lag_lo = max(1, int(fps * 60.0 / 200.0))
    lag_hi = min(ac.size - 1, int(fps * 60.0 / 50.0))
    if lag_hi <= lag_lo:
        return 0.0
    return float(np.max(ac[lag_lo:lag_hi]) / ac0)


def detect_talkover(segments, file_path, ratio):
    """
    A speech ("unknown") segment with a musical bed underneath (DJ talking
    over a song's intro/outro) is relabelled "talkover" so the skip toggles
    leave it alone — skipping it would eat the song.

    Self-calibrating: compare each speech segment's pulse clarity against the
    MEDIAN pulse clarity of this recording's own music segments. A speech
    segment scoring >= ratio * music_median has a beat under it => talkover.
    No absolute thresholds, no training.
    """
    import librosa
    import numpy as np

    sr = 16000
    y, _ = librosa.load(file_path, sr=sr, mono=True)
    n = len(y)

    def clip_of(s):
        a = max(0, int(s["startSec"] * sr))
        b = min(n, int(s["endSec"] * sr))
        return y[a:b]

    music_scores = []
    for s in segments:
        if s["type"] == "music":
            pc = _pulse_clarity(clip_of(s), sr)
            if pc is not None:
                music_scores.append(pc)

    if not music_scores:
        log("[talkover] no music reference — skipping talkover pass")
        return segments

    music_med = float(np.median(music_scores))
    threshold = ratio * music_med
    log(f"[talkover] music pulse median={music_med:.4f} "
        f"threshold={threshold:.4f} (ratio={ratio})")

    flipped = 0
    for s in segments:
        if s["type"] != "unknown":
            continue
        pc = _pulse_clarity(clip_of(s), sr)
        if pc is None:
            log(f"[talkover] {s['startSec']:7.1f}-{s['endSec']:7.1f} "
                f"too short, kept speech")
            continue
        is_talkover = pc >= threshold
        log(f"[talkover] {s['startSec']:7.1f}-{s['endSec']:7.1f} "
            f"pulse={pc:.4f} -> {'TALKOVER' if is_talkover else 'speech'}")
        if is_talkover:
            s["type"] = "talkover"
            flipped += 1

    log(f"[talkover] reclassified {flipped} speech -> talkover")
    return segments


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
    parser.add_argument(
        "--talkover",
        action="store_true",
        help="EXPERIMENTAL: run the (unreliable) speech-over-music heuristic. "
        "Off by default — talkover is set by the Phase 3 classifier / editor.",
    )
    parser.add_argument(
        "--talkover-ratio",
        type=float,
        default=0.5,
        help="speech seg is talkover if its pulse clarity >= "
        "ratio * median(music pulse clarity)",
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

    if args.talkover:
        segments = detect_talkover(
            segments,
            args.file,
            args.talkover_ratio,
        )
        # re-merge any adjacent same-type runs created by relabelling
        merged: list[dict] = []
        for s in segments:
            if merged and merged[-1]["type"] == s["type"]:
                merged[-1]["endSec"] = s["endSec"]
            else:
                merged.append(s)
        segments = merged

    if not segments:
        log("[process] no segments produced")
        json.dump(
            {"id": args.id, "duration": 0.0, "segments": []}, _REAL_STDOUT
        )
        _REAL_STDOUT.flush()
        return 0

    duration = segments[-1]["endSec"]
    music_n = sum(1 for s in segments if s["type"] == "music")
    talk_n = sum(1 for s in segments if s["type"] == "talkover")
    speech_n = sum(1 for s in segments if s["type"] == "unknown")
    log(f"[process] result: {music_n} music, {speech_n} speech, "
        f"{talk_n} talkover")

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
