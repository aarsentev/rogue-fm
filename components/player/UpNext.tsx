"use client";

import { fmtTime } from "@/lib/types";
import { segmentLabel, type Seg } from "@/lib/broadcast/skipLogic";

type Props = {
  segments: Seg[];
  positionSec: number;
  hasSegmentData: boolean;
  // When provided (seek mode on), rows are clickable and jump to the
  // segment's start offset within the current recording.
  onSeek?: (sec: number) => void;
};

export function UpNext({
  segments,
  positionSec,
  hasSegmentData,
  onSeek,
}: Props) {
  if (!hasSegmentData) {
    return (
      <div className="mt-10 mb-6">
        <p className="text-[10px] text-ink-7 tracking-[0.1em] uppercase mb-2.5">
          Up next
        </p>
        <p className="text-[12px] text-ink-7">
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
        <p className="text-[10px] text-ink-7 tracking-[0.1em] uppercase mb-2.5">
          Up next
        </p>
        <p className="text-[12px] text-ink-7">End of recording — loops.</p>
      </div>
    );
  }

  return (
    <div className="mt-10 mb-6">
      <p className="text-[10px] text-ink-7 tracking-[0.1em] uppercase mb-2.5">
        Up next
      </p>
      {upcoming.map((s, i) => {
        const hasTrack = s.type === "music" || s.type === "talkover";
        const name =
          hasTrack && s.trackTitle
            ? `${s.trackTitle}${s.trackArtist ? " — " + s.trackArtist : ""}`
            : s.label?.trim() || segmentLabel(s.type);
        const seekable = !!onSeek;
        return (
          <div
            key={`${s.startSec}-${i}`}
            onClick={seekable ? () => onSeek(s.startSec) : undefined}
            role={seekable ? "button" : undefined}
            tabIndex={seekable ? 0 : undefined}
            onKeyDown={
              seekable
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSeek(s.startSec);
                    }
                  }
                : undefined
            }
            className={`flex items-center gap-3.5 px-3.5 py-2 rounded-lg mb-0.5 ${
              seekable
                ? "cursor-pointer hover:bg-raised transition-colors"
                : ""
            }`}
            style={{ background: i === 0 ? "var(--color-surface)" : "transparent" }}
          >
            <span className="text-[11px] text-ink-7 w-3.5 text-center">
              {i + 1}
            </span>
            <span
              className="text-[13px] flex-1 truncate"
              style={{ color: i === 0 ? "var(--color-ink-2)" : "var(--color-ink-6)" }}
            >
              {name}
            </span>
            <span className="text-[11px] text-ink-7 ml-4">
              {fmtTime(s.endSec - s.startSec)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
