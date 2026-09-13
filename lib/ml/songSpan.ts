export type SpanSeg = {
  id: string;
  startSec: number;
  endSec: number;
  type: string;
};

export type Span = { startSec: number; endSec: number; segmentCount: number };

const SONG = new Set(["music", "talkover"]);
const HARD = new Set(["ad", "jingle"]);

const isSong = (s: SpanSeg) => SONG.has(s.type);
// Non-song, non-boundary (brief DJ chatter): bridge it only when short.
const isBridgeable = (s: SpanSeg) => !SONG.has(s.type) && !HARD.has(s.type);
const dur = (s: SpanSeg) => s.endSec - s.startSec;

/**
 * Expand a segment to the whole song it belongs to: the contiguous run of
 * music/talkover around it, bridging only SHORT non-song gaps (a brief DJ
 * remark mid-song) and never crossing ads, jingles, or long talk breaks.
 *
 * This is the fix for a song chopped in half by a talkover — fingerprinting
 * the bare music half fails AcoustID's duration-aware match, but the merged
 * span covers the whole track at its true length.
 */
export function songSpan(
  segments: SpanSeg[],
  targetId: string,
  maxBridgeSec = 20,
): Span | null {
  const sorted = [...segments].sort((a, b) => a.startSec - b.startSec);
  const t = sorted.findIndex((s) => s.id === targetId);
  if (t < 0) return null;

  let lo = t;
  let hi = t;

  // Only a song segment grows into a span; anything else stands alone.
  if (isSong(sorted[t])) {
    for (let i = t; i - 1 >= 0; ) {
      const prev = sorted[i - 1];
      if (isSong(prev)) {
        lo = i - 1;
        i -= 1;
      } else if (
        isBridgeable(prev) &&
        dur(prev) <= maxBridgeSec &&
        i - 2 >= 0 &&
        isSong(sorted[i - 2])
      ) {
        lo = i - 2;
        i -= 2;
      } else break;
    }
    for (let j = t; j + 1 < sorted.length; ) {
      const next = sorted[j + 1];
      if (isSong(next)) {
        hi = j + 1;
        j += 1;
      } else if (
        isBridgeable(next) &&
        dur(next) <= maxBridgeSec &&
        j + 2 < sorted.length &&
        isSong(sorted[j + 2])
      ) {
        hi = j + 2;
        j += 2;
      } else break;
    }
  }

  return {
    startSec: sorted[lo].startSec,
    endSec: sorted[hi].endSec,
    segmentCount: hi - lo + 1,
  };
}
