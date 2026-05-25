"use client";

import {
  SEGMENT_COLORS as SEG_COLOR,
  segmentLabel,
  type Seg,
} from "@/lib/skipLogic";

type Props = {
  segments: Seg[];
  duration: number;
  positionSec: number;
  accent: string;
  onSeek?: (sec: number) => void;
};

// Order legend entries the same way across recordings so the layout is stable.
const LEGEND_ORDER = [
  "music",
  "talkover",
  "dj",
  "ad",
  "jingle",
  "unknown",
] as const;

export function SegmentRibbon({
  segments,
  duration,
  positionSec,
  accent,
  onSeek,
}: Props) {
  if (segments.length === 0 || duration <= 0) return null;

  const playheadPct = Math.max(
    0,
    Math.min(100, (positionSec / duration) * 100),
  );

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onSeek) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const frac = (e.clientX - rect.left) / rect.width;
    onSeek(Math.max(0, Math.min(1, frac)) * duration);
  };

  const presentTypes = LEGEND_ORDER.filter((t) =>
    segments.some((s) => s.type === t),
  );

  return (
    <div className="mt-3">
      <div
        onClick={handleClick}
        className={`relative h-[6px] w-full rounded overflow-hidden bg-[#141414] ${
          onSeek ? "cursor-pointer h-[10px]" : ""
        }`}
      >
        {segments.map((s, i) => {
          const left = (s.startSec / duration) * 100;
          const width = ((s.endSec - s.startSec) / duration) * 100;
          return (
            <div
              key={i}
              className="absolute top-0 h-full"
              style={{
                left: `${left}%`,
                width: `${width}%`,
                background: SEG_COLOR[s.type] ?? "#2c2c2c",
              }}
              title={`${segmentLabel(s.type)}  ${s.startSec.toFixed(0)}–${s.endSec.toFixed(0)}s`}
            />
          );
        })}
        <div
          className="absolute top-[-2px] h-[10px] w-[2px]"
          style={{ left: `${playheadPct}%`, background: accent }}
        />
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[10px] text-[#3a3a3a]">
        {presentTypes.map((t) => (
          <span key={t} className="flex items-center gap-1">
            <span
              className="inline-block w-2 h-2 rounded-[1px]"
              style={{ background: SEG_COLOR[t] }}
            />
            {segmentLabel(t).replace(/^\W+\s*/, "").toLowerCase()}
          </span>
        ))}
        <span className="ml-auto text-[#2a2a2a]">
          {segments.length} segments
        </span>
      </div>
    </div>
  );
}
