"use client";

import { fmtTime, type StationDetail } from "@/lib/types";
import type { ClockState } from "@/lib/broadcastClock";
import { segmentLabel, type Seg } from "@/lib/skipLogic";
import { SegmentRibbon } from "./SegmentRibbon";

type Props = {
  detail: StationDetail;
  state: ClockState | null;
  currentType: string | null;
  segments: Seg[];
  onSeek?: (sec: number) => void;
};

export function NowPlaying({
  detail,
  state,
  currentType,
  segments,
  onSeek,
}: Props) {
  const progress = state
    ? (state.offsetInRecording / state.recording.duration) * 100
    : 0;

  const recordingName =
    state?.recording.displayName ?? state?.recording.filename ?? "—";

  return (
    <>
      <div className="mb-1.5">
        <span className="text-[11px] text-[#c0392b] tracking-[0.12em] font-semibold">
          ● ON AIR
        </span>
      </div>
      <h1
        className="text-[40px] font-semibold m-0 leading-none tracking-[-0.03em]"
        style={{ color: detail.station.color }}
      >
        {detail.station.name}
      </h1>
      <p className="text-sm text-[#444] mt-1 mb-8">
        {detail.station.freq} FM · {detail.station.genre}
      </p>

      <div className="bg-[#0f0f0f] rounded-2xl px-8 py-7 border border-[#181818]">
        <p className="text-[10px] text-[#3a3a3a] tracking-[0.1em] uppercase mb-2.5">
          Now playing
        </p>
        <p className="text-[24px] font-medium mb-1 text-white truncate">
          {recordingName}
        </p>
        <p className="text-[14px] text-[#666] mb-7">
          {segmentLabel(currentType)}
        </p>

        <div className="h-[3px] bg-[#1e1e1e] rounded mb-2">
          <div
            className="h-full rounded transition-[width] duration-[1s] ease-linear"
            style={{
              width: `${progress}%`,
              background: detail.station.color,
            }}
          />
        </div>
        <div className="flex justify-between items-center">
          <span className="text-[11px] text-[#444]">
            {fmtTime(state?.offsetInRecording ?? 0)}
          </span>
          <span className="text-[10px] text-[#2a2a2a] tracking-[0.08em]">
            LIVE · NO SCRUBBING
          </span>
          <span className="text-[11px] text-[#444]">
            {fmtTime(state?.recording.duration ?? 0)}
          </span>
        </div>

        <SegmentRibbon
          segments={segments}
          duration={state?.recording.duration ?? 0}
          positionSec={state?.offsetInRecording ?? 0}
          accent={detail.station.color}
          onSeek={onSeek}
        />
      </div>
    </>
  );
}
