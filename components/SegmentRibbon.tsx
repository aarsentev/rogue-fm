"use client";

import type { Seg } from "@/lib/skipLogic";

const SEG_COLOR: Record<string, string> = {
  music: "#2c2c2c",
  unknown: "#c0392b",
  dj: "#2f6fb0",
  ad: "#c0392b",
  jingle: "#c9a227",
  talkover: "#7d5fb0",
};

type Props = {
  segments: Seg[];
  duration: number;
  positionSec: number;
  accent: string;
};

export function SegmentRibbon({
  segments,
  duration,
  positionSec,
  accent,
}: Props) {
  if (segments.length === 0 || duration <= 0) return null;

  const playheadPct = Math.max(
    0,
    Math.min(100, (positionSec / duration) * 100),
  );

  return (
    <div className="mt-3">
      <div className="relative h-[6px] w-full rounded overflow-hidden bg-[#141414]">
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
              title={`${s.type}  ${s.startSec.toFixed(0)}–${s.endSec.toFixed(0)}s`}
            />
          );
        })}
        <div
          className="absolute top-[-2px] h-[10px] w-[2px]"
          style={{ left: `${playheadPct}%`, background: accent }}
        />
      </div>
      <div className="flex gap-4 mt-2 text-[10px] text-[#3a3a3a]">
        <span className="flex items-center gap-1">
          <span
            className="inline-block w-2 h-2 rounded-[1px]"
            style={{ background: SEG_COLOR.music }}
          />
          music
        </span>
        <span className="flex items-center gap-1">
          <span
            className="inline-block w-2 h-2 rounded-[1px]"
            style={{ background: SEG_COLOR.unknown }}
          />
          talk
        </span>
        <span className="flex items-center gap-1">
          <span
            className="inline-block w-2 h-2 rounded-[1px]"
            style={{ background: SEG_COLOR.talkover }}
          />
          over music
        </span>
        <span className="ml-auto text-[#2a2a2a]">
          {segments.length} segments
        </span>
      </div>
    </div>
  );
}
