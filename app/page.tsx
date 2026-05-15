"use client";

import { useEffect, useRef, useState } from "react";
import {
  getStationState,
  type Recording,
  type StationTimeline,
} from "@/lib/broadcastClock";
import { getPlayer } from "@/lib/player";

type StationSummary = {
  id: string;
  name: string;
  freq: string;
  genre: string;
  color: string;
  sortOrder: number;
};

type StationDetail = {
  station: { id: string; name: string; freq: string; genre: string; color: string };
  recordings: Recording[];
  totalDuration: number;
  epoch: number;
};

function fmt(secs: number) {
  if (!isFinite(secs) || secs < 0) return "0:00";
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function Home() {
  const [stations, setStations] = useState<StationSummary[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<StationDetail | null>(null);
  const [started, setStarted] = useState(false);
  const [, setTick] = useState(0);
  const playerRef = useRef(getPlayer());

  useEffect(() => {
    fetch("/api/stations")
      .then((r) => r.json())
      .then((d: { stations: StationSummary[] }) => {
        setStations(d.stations);
        if (d.stations[0]) setSelectedId(d.stations[0].id);
      })
      .catch((e) => console.error("failed to load stations", e));
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    fetch(`/api/stations/${selectedId}`)
      .then((r) => r.json())
      .then(setDetail)
      .catch((e) => console.error("failed to load station detail", e));
  }, [selectedId]);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!started || !detail) return;
    const state = getStationState(
      { recordings: detail.recordings, totalDuration: detail.totalDuration },
      detail.epoch,
    );
    if (state) {
      playerRef.current.loadAndSync(state.recording.id, state.offsetInRecording);
    }
  }, [started, detail]);

  useEffect(() => {
    if (!started || !detail) return;
    const id = setInterval(() => {
      const state = getStationState(
        { recordings: detail.recordings, totalDuration: detail.totalDuration },
        detail.epoch,
      );
      if (state) {
        playerRef.current.loadAndSync(state.recording.id, state.offsetInRecording);
      }
    }, 3000);
    return () => clearInterval(id);
  }, [started, detail]);

  if (!stations || !detail) {
    return (
      <div className="min-h-screen bg-[#080808] text-[#666] flex items-center justify-center font-sans">
        Loading…
      </div>
    );
  }

  const timeline: StationTimeline = {
    recordings: detail.recordings,
    totalDuration: detail.totalDuration,
  };
  const state = getStationState(timeline, detail.epoch);
  const progress = state
    ? (state.offsetInRecording / state.recording.duration) * 100
    : 0;

  return (
    <div className="min-h-screen bg-[#080808] text-white font-sans flex flex-col">
      <header className="px-8 py-4 border-b border-[#141414] flex items-center gap-3">
        <div className="w-[7px] h-[7px] rounded-full bg-[#c0392b] animate-pulse" />
        <span className="text-xs font-semibold tracking-[0.15em] text-[#666]">
          ROGUE FM
        </span>
        <span className="ml-auto text-[11px] text-[#333]">
          personal build · local files
        </span>
      </header>

      <main className="flex-1 px-14 py-11 max-w-[760px]">
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
          <p className="text-[10px] text-[#3a3a3a] tracking-[0.1em] uppercase mb-3.5">
            Now playing
          </p>
          <p className="text-[26px] font-medium mb-1 text-white">
            {state?.recording.displayName ?? state?.recording.filename ?? "—"}
          </p>
          <p className="text-[15px] text-[#666] mb-7">♫ Music</p>

          <div className="h-[3px] bg-[#1e1e1e] rounded mb-2">
            <div
              className="h-full rounded transition-[width] duration-[1s] ease-linear"
              style={{ width: `${progress}%`, background: detail.station.color }}
            />
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[11px] text-[#444]">
              {fmt(state?.offsetInRecording ?? 0)}
            </span>
            <span className="text-[10px] text-[#2a2a2a] tracking-[0.08em]">
              LIVE · NO SCRUBBING
            </span>
            <span className="text-[11px] text-[#444]">
              {fmt(state?.recording.duration ?? 0)}
            </span>
          </div>
        </div>

        {!started && (
          <button
            onClick={() => setStarted(true)}
            className="mt-8 px-6 py-3 rounded-lg border border-[#181818] bg-[#0f0f0f] hover:bg-[#141414] text-sm text-[#aaa] transition-colors"
          >
            Tap to tune in
          </button>
        )}

        <p className="text-[10px] text-[#2a2a2a] tracking-[0.08em] mt-8">
          {stations.length} stations loaded · sidebar arrives in next commit
        </p>
      </main>
    </div>
  );
}
