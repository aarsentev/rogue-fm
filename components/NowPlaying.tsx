"use client";

import { fmtTime, type StationDetail } from "@/lib/types";
import type { ClockState } from "@/lib/broadcastClock";
import { Cover } from "./Cover";

type Props = {
  detail: StationDetail;
  state: ClockState | null;
};

export function NowPlaying({ detail, state }: Props) {
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
        className="text-[56px] font-semibold m-0 leading-none tracking-[-0.03em]"
        style={{ color: detail.station.color }}
      >
        {detail.station.name}
      </h1>
      <p className="text-sm text-[#444] mt-1 mb-11">
        {detail.station.freq} FM · {detail.station.genre}
      </p>

      <div className="bg-[#0f0f0f] rounded-2xl px-8 py-7 border border-[#181818]">
        <div className="flex items-center gap-6 mb-7">
          <Cover
            freq={detail.station.freq}
            name={detail.station.name}
            color={detail.station.color}
            size={96}
            rounded={10}
            className="shrink-0"
          />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] text-[#3a3a3a] tracking-[0.1em] uppercase mb-2.5">
              Now playing
            </p>
            <p className="text-[22px] font-medium mb-1 text-white truncate">
              {recordingName}
            </p>
            <p className="text-[14px] text-[#666]">♫ Music</p>
          </div>
        </div>

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
      </div>
    </>
  );
}
