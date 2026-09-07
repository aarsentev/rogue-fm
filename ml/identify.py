"""
Rogue FM — segment track identifier.

Fingerprints ONE segment's audio with Chromaprint (fpcalc) and looks it up on
the AcoustID web service, returning MusicBrainz track metadata.

Why slice first: a recording is a whole radio hour of many songs. To identify
the song under a given segment we fingerprint just that segment's audio, not the
entire file. We cap the analysed span (a match needs only a chunk, and short
fingerprints keep the API fast).

stdout: pure JSON  -> consumed by the Next API route / coverage script
stderr: human logs  -> ignored by the caller

Usage:
    uv run python identify.py --file ../storage/recordings/"Flash FM.mp3" \
        --start 8 --end 186 --id <segmentId>

    # no network — just prove the ffmpeg+fpcalc chain works:
    uv run python identify.py --file ... --start 8 --end 186 --fingerprint-only

Requires: fpcalc (brew install chromaprint), ffmpeg, and env ACOUSTID_API_KEY.
"""

import argparse
import json
import os
import subprocess
import sys
import tempfile

# Keep real stdout pristine for the JSON contract; everything else -> stderr.
_REAL_STDOUT = sys.stdout
sys.stdout = sys.stderr

FPCALC = os.environ.get("FPCALC", "fpcalc")
FFMPEG = os.environ.get("FFMPEG", "ffmpeg")
API_KEY = os.environ.get("ACOUSTID_API_KEY", "").strip()

# Fingerprint (close to) the WHOLE segment and send its true duration.
# AcoustID's index is duration-aware — a short fragment claiming a short
# duration will NOT match a full-length song, so we must not truncate to the
# fpcalc default of 120s. Cap only to keep pathological runs bounded.
MAX_FP_SECONDS = 600.0


def log(*a):
    print(*a, file=sys.stderr, flush=True)


def emit(obj: dict) -> None:
    json.dump(obj, _REAL_STDOUT)
    _REAL_STDOUT.flush()


def slice_audio(file: str, start: float, end: float, dst: str) -> None:
    """Extract [start, start+dur) to a mono wav for fingerprinting."""
    dur = max(1.0, min(MAX_FP_SECONDS, end - start))
    subprocess.run(
        [
            FFMPEG, "-nostdin", "-v", "error",
            "-ss", f"{max(0.0, start):.3f}",
            "-t", f"{dur:.3f}",
            "-i", file,
            "-ac", "1", "-ar", "44100",
            "-y", dst,
        ],
        check=True,
    )


def fingerprint(path: str) -> tuple[str, float]:
    # -length must exceed the slice or fpcalc truncates to its 120s default,
    # which breaks matching against full-length recordings.
    out = subprocess.run(
        [FPCALC, "-json", "-length", str(int(MAX_FP_SECONDS) + 10), path],
        check=True, capture_output=True, text=True,
    )
    d = json.loads(out.stdout)
    return d["fingerprint"], float(d["duration"])


def best_match(results: list) -> dict | None:
    """Top AcoustID result (already score-sorted) that carries a recording."""
    for r in results:
        score = float(r.get("score", 0.0))
        for rec in r.get("recordings", []) or []:
            artists = rec.get("artists") or []
            artist = ", ".join(a.get("name", "") for a in artists) or None
            rgs = rec.get("releasegroups") or []
            album = rgs[0].get("title") if rgs else None
            return {
                "score": round(score, 4),
                "mbid": rec.get("id"),
                "title": rec.get("title"),
                "artist": artist,
                "album": album,
            }
    return None


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--file", required=True)
    ap.add_argument("--start", type=float, default=0.0)
    ap.add_argument("--end", type=float, required=True)
    ap.add_argument("--id", default=None, help="segment id, echoed back")
    ap.add_argument(
        "--fingerprint-only",
        action="store_true",
        help="skip the AcoustID lookup (no API key needed) — chain smoke test",
    )
    args = ap.parse_args()

    with tempfile.TemporaryDirectory() as td:
        wav = os.path.join(td, "slice.wav")
        log(f"[identify] slicing {args.start:.1f}-{args.end:.1f}s from {args.file}")
        slice_audio(args.file, args.start, args.end, wav)
        fp, dur = fingerprint(wav)
        log(f"[identify] fingerprint {len(fp)} chars, dur={dur:.1f}s")

        if args.fingerprint_only:
            emit({"id": args.id, "fingerprinted": True,
                  "fpDurationSec": round(dur, 3)})
            return 0

        if not API_KEY:
            log("[identify] ACOUSTID_API_KEY not set")
            emit({"id": args.id, "error": "no_api_key"})
            return 0

        import acoustid

        try:
            resp = acoustid.lookup(
                API_KEY, fp, dur, meta="recordings releasegroups"
            )
        except acoustid.WebServiceError as e:
            log(f"[identify] acoustid web error: {e}")
            emit({"id": args.id, "error": f"acoustid: {e}"})
            return 0

        if resp.get("status") != "ok":
            err = resp.get("error") or {}
            msg = err.get("message") if isinstance(err, dict) else err
            log(f"[identify] acoustid status={resp.get('status')} "
                f"code={err.get('code') if isinstance(err, dict) else '?'} "
                f"message={msg}")
            emit({"id": args.id, "error": f"acoustid: {msg or 'unknown'}"})
            return 0

        results = resp.get("results", []) or []
        m = best_match(results)
        if not m:
            if results:
                # A fingerprint matched, but that AcoustID entry has no linked
                # MusicBrainz recording — acoustically known, metadata unknown.
                top = round(float(results[0].get("score", 0.0)), 4)
                log(f"[identify] acoustic match (score={top}) but no metadata")
                emit({"id": args.id, "matched": False,
                      "acousticScore": top})
            else:
                log("[identify] no match")
                emit({"id": args.id, "matched": False})
            return 0

        log(f"[identify] MATCH score={m['score']} "
            f"{m['artist']} — {m['title']}")
        emit({"id": args.id, "matched": True, **m})
        return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as e:  # noqa: BLE001
        log(f"[identify] FAILED: {e}")
        emit({"error": str(e)})
        sys.exit(1)
