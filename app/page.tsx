"use client";

import { useEffect, useRef, useState } from "react";
import { getStationState, getUpcomingRecordings } from "@/lib/broadcastClock";
import { getPlayer } from "@/lib/player";
import { useMediaSession } from "@/lib/mediaSession";
import type { StationDetail, StationSummary } from "@/lib/types";
import { Topbar } from "@/components/Topbar";
import { Sidebar } from "@/components/Sidebar";
import { CoverFlow } from "@/components/CoverFlow";
import { NowPlaying } from "@/components/NowPlaying";
import { UpNext } from "@/components/UpNext";
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
    const player = playerRef.current;

    const evalAndSync = () => {
      const s = getStationState(
        { recordings: detail.recordings, totalDuration: detail.totalDuration },
        detail.epoch,
      );
      if (s) player.loadAndSync(s.recording.id, s.offsetInRecording);
    };

    evalAndSync();
    player.setOnEnded(evalAndSync);
    const id = setInterval(evalAndSync, 3000);

    return () => {
      clearInterval(id);
      player.setOnEnded(null);
    };
  }, [started, detail]);

  const state = detail
    ? getStationState(
        { recordings: detail.recordings, totalDuration: detail.totalDuration },
        detail.epoch,
      )
    : null;

  const cycleStation = (delta: number) => {
    if (!stations || !selectedId) return;
    const idx = stations.findIndex((s) => s.id === selectedId);
    if (idx < 0) return;
    const next = stations[(idx + delta + stations.length) % stations.length];
    if (next) setSelectedId(next.id);
  };

  useMediaSession(detail, state, started, {
    onPlay: () => setStarted(true),
    onPause: () => {
      playerRef.current.unload();
      setStarted(false);
    },
    onNext: () => cycleStation(1),
    onPrev: () => cycleStation(-1),
  });

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
        <main className="flex-1 px-14 py-11 flex flex-col">
          <CoverFlow
            stations={stations ?? []}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />

          {!detail ? (
            <div className="text-[#666] mt-8">Loading station…</div>
          ) : (
            <>
              <div className="max-w-[760px] w-full mt-6">
                <NowPlaying detail={detail} state={state} />

                <UpNext
                  items={
                    state
                      ? getUpcomingRecordings(
                          {
                            recordings: detail.recordings,
                            totalDuration: detail.totalDuration,
                          },
                          state.recordingIndex,
                          3,
                        )
                      : []
                  }
                />

                <button
                  onClick={() => {
                    if (started) {
                      playerRef.current.unload();
                      setStarted(false);
                    } else {
                      setStarted(true);
                    }
                  }}
                  className="mt-8 px-6 py-3 rounded-lg border border-[#181818] bg-[#0f0f0f] hover:bg-[#141414] text-sm text-[#aaa] transition-colors"
                >
                  {started ? "Tune out" : "Tap to tune in"}
                </button>
              </div>

              <div className="mt-auto pt-10 max-w-[760px] w-full">
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
