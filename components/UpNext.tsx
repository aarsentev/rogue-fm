"use client";

import { fmtTime } from "@/lib/types";
import { segmentLabel, type Seg } from "@/lib/skipLogic";

type Props = {
  segments: Seg[];
  positionSec: number;
  hasSegmentData: boolean;
};

export function UpNext({ segments, positionSec, hasSegmentData }: Props) {
  if (!hasSegmentData) {
    return (
      <div className="mt-10 mb-6">
        <p className="text-[10px] text-[#333] tracking-[0.1em] uppercase mb-2.5">
          Up next
        </p>
        <p className="text-[12px] text-[#3a3a3a]">
          No segment data — process this recording in Library.
        </p>
      </div>
    );
  }

  const upcoming = segments
    .filter((s) => s.startSec > positionSec)
    .slice(0, 5);

  if (upcoming.length === 0) {
    return (
      <div className="mt-10 mb-6">
        <p className="text-[10px] text-[#333] tracking-[0.1em] uppercase mb-2.5">
          Up next
        </p>
        <p className="text-[12px] text-[#3a3a3a]">End of recording — loops.</p>
      </div>
    );
  }

  return (
    <div className="mt-10 mb-6">
      <p className="text-[10px] text-[#333] tracking-[0.1em] uppercase mb-2.5">
        Up next
      </p>
      {upcoming.map((s, i) => {
        const hasTrack = s.type === "music" || s.type === "talkover";
        const name =
          hasTrack && s.trackTitle
            ? `${s.trackTitle}${s.trackArtist ? " — " + s.trackArtist : ""}`
            : s.label?.trim() || segmentLabel(s.type);
        return (
          <div
            key={`${s.startSec}-${i}`}
            className="flex items-center gap-3.5 px-3.5 py-2 rounded-lg mb-0.5"
            style={{ background: i === 0 ? "#0f0f0f" : "transparent" }}
          >
            <span className="text-[11px] text-[#2e2e2e] w-3.5 text-center">
              {i + 1}
            </span>
            <span
              className="text-[13px] flex-1 truncate"
              style={{ color: i === 0 ? "#aaa" : "#444" }}
            >
              {name}
            </span>
            <span className="text-[11px] text-[#2a2a2a] ml-4">
              {fmtTime(s.endSec - s.startSec)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
