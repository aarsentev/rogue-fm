export type SkipFlags = { skipDJ: boolean; skipAds: boolean };

export type Seg = {
  startSec: number;
  endSec: number;
  type: string;
  label?: string | null;
  trackTitle?: string | null;
  trackArtist?: string | null;
};

/**
 * The segments that come after `posSec`, in order, capped at `count`.
 * The segment currently playing is excluded (it's "now", not "next").
 */
export function upcomingSegments(
  segments: Seg[],
  posSec: number,
  count: number,
): Seg[] {
  return segments.filter((s) => s.startSec > posSec).slice(0, count);
}

/**
 * Whether a segment of `type` should be auto-skipped given the toggles.
 *
 * Phase 2 baseline: the classifier doesn't exist yet, so all speech is
 * "unknown". Treat "unknown" as skippable if EITHER speech toggle is on.
 * Phase 3 will split unknown -> dj/ad/jingle and this stays correct.
 */
export function isSkippable(type: string, f: SkipFlags): boolean {
  if (!f.skipDJ && !f.skipAds) return false;
  switch (type) {
    case "dj":
      return f.skipDJ;
    case "ad":
      return f.skipAds;
    case "unknown":
      return f.skipDJ || f.skipAds;
    case "music":
    case "jingle":
    case "talkover":
    default:
      // talkover = DJ over a song; skipping it would eat the music.
      return false;
  }
}

/**
 * If `posSec` falls inside a skippable segment, return the time to seek to
 * (just past that segment). Otherwise null. Repeated calls naturally chain
 * through consecutive skippable segments.
 */
export function skipTarget(
  segments: Seg[],
  posSec: number,
  flags: SkipFlags,
): number | null {
  if (!flags.skipDJ && !flags.skipAds) return null;
  const seg = segments.find(
    (s) => posSec >= s.startSec && posSec < s.endSec,
  );
  if (seg && isSkippable(seg.type, flags)) {
    return seg.endSec + 0.05;
  }
  return null;
}

const TYPE_LABEL: Record<string, string> = {
  music: "♫ Music",
  dj: "💬 Comment",
  ad: "📣 Ad",
  jingle: "🔔 Jingle",
  talkover: "🎤 Over music",
  unknown: "❔ TBD",
};

export const SEGMENT_TYPES = [
  "music",
  "dj",
  "ad",
  "jingle",
  "talkover",
  "unknown",
] as const;
export type SegmentType = (typeof SEGMENT_TYPES)[number];

export function segmentLabel(type: string | null | undefined): string {
  if (!type) return "♫ Music";
  return TYPE_LABEL[type] ?? "♫ Music";
}

export function segmentAt(
  segments: Seg[],
  posSec: number,
): Seg | null {
  return (
    segments.find((s) => posSec >= s.startSec && posSec < s.endSec) ?? null
  );
}
