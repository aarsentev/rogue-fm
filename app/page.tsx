"use client";

import { useEffect, useRef, useState } from "react";
import { getStationState } from "@/lib/broadcastClock";
import { getPlayer } from "@/lib/player";
import type { StationDetail, StationSummary } from "@/lib/types";
import { Topbar } from "@/components/Topbar";
import { Sidebar } from "@/components/Sidebar";
import { NowPlaying } from "@/components/NowPlaying";
import { SkipControls } from "@/components/SkipControls";

export default function Home() {
  const [stations, setStations] = useState<StationSummary[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<StationDetail | null>(null);
  const [started, setStarted] = useState(false);
  const [skipDJ, setSkipDJ] = useState(false);
  const [skipAds, setSkipAds] = useState(false);
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
    setDetail(null);
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

  const state =
    detail &&
    getStationState(
      { recordings: detail.recordings, totalDuration: detail.totalDuration },
      detail.epoch,
    );

  return (
    <div className="min-h-screen bg-[#080808] text-white flex flex-col">
      <Topbar />
      <div className="flex flex-1">
        <Sidebar
          stations={stations ?? []}
          selectedId={selectedId}
          activeRecordingName={state?.recording.displayName ?? null}
          onSelect={setSelectedId}
        />
        <main className="flex-1 px-14 py-11 max-w-[760px] flex flex-col">
          {!detail ? (
            <div className="text-[#666]">Loading station…</div>
          ) : (
            <>
              <NowPlaying detail={detail} state={state} />

              {!started && (
                <button
                  onClick={() => setStarted(true)}
                  className="mt-8 px-6 py-3 rounded-lg border border-[#181818] bg-[#0f0f0f] hover:bg-[#141414] text-sm text-[#aaa] transition-colors self-start"
                >
                  Tap to tune in
                </button>
              )}

              <div className="mt-auto pt-10">
                <SkipControls
                  color={detail.station.color}
                  skipDJ={skipDJ}
                  skipAds={skipAds}
                  onToggleDJ={() => setSkipDJ((v) => !v)}
                  onToggleAds={() => setSkipAds((v) => !v)}
                />
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
