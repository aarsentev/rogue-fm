"use client";

import { useEffect, useState } from "react";
import { getStationState } from "@/lib/broadcastClock";
import { getPlayer } from "@/lib/player";
import {
  useBroadcast,
  tuneIn,
  tuneOut,
  setStationDetail,
  setSegments,
  setSkipFlags,
  overrideEpoch,
} from "@/lib/broadcastEngine";
import { useMediaSession } from "@/lib/mediaSession";
import { segmentAt, type Seg } from "@/lib/skipLogic";
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
  const { started, detail, segments, skipDJ, skipAds, epochOverride } =
    useBroadcast();
  const [, setTick] = useState(0);

  // Dev-only scrub: shift a local epoch override so the broadcast clock
  // "time-travels" to a clicked position. Never persisted; prod stays live.
  const DEV = process.env.NODE_ENV !== "production";
  const [scrub, setScrub] = useState(false);

  useEffect(() => {
    fetch("/api/stations")
      .then((r) => r.json())
      .then((d: { stations: StationSummary[] }) => {
        setStations(d.stations);
        // Re-entering the page while the engine is already on a station:
        // restore that selection instead of resetting to the first one.
        setSelectedId(
          (cur) => cur ?? detail?.station.id ?? d.stations[0]?.id ?? null,
        );
      })
      .catch((e) => console.error("failed to load stations", e));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    if (detail?.station.id === selectedId) return; // engine already on it
    setStationDetail(null);
    fetch(`/api/stations/${selectedId}`)
      .then((r) => r.json())
      .then((d: StationDetail) => setStationDetail(d))
      .catch((e) => console.error("failed to load station detail", e));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const state = detail
    ? getStationState(
        { recordings: detail.recordings, totalDuration: detail.totalDuration },
        epochOverride ?? detail.epoch,
      )
    : null;

  const handleScrubSeek = (offsetSec: number) => {
    if (!detail || !state) return;
    let preceding = 0;
    for (let i = 0; i < state.recordingIndex; i++) {
      preceding += detail.recordings[i].duration;
    }
    const globalElapsed = preceding + offsetSec;
    overrideEpoch(Date.now() - globalElapsed * 1000);
    getPlayer().seekTo(offsetSec);
  };

  const cycleStation = (delta: number) => {
    if (!stations || !selectedId) return;
    const idx = stations.findIndex((s) => s.id === selectedId);
    if (idx < 0) return;
    const next = stations[(idx + delta + stations.length) % stations.length];
    if (next) setSelectedId(next.id);
  };

  useMediaSession(detail, state, started, {
    onPlay: tuneIn,
    onPause: tuneOut,
    onNext: () => cycleStation(1),
    onPrev: () => cycleStation(-1),
  });

  const activeRecId = state?.recording.id ?? null;

  // Load segments for whatever recording is currently on air.
  useEffect(() => {
    if (!activeRecId) {
      setSegments([]);
      return;
    }
    let cancelled = false;
    fetch(`/api/recordings/${activeRecId}`)
      .then((r) => r.json())
      .then((d: { segments?: Seg[] }) => {
        if (!cancelled) setSegments(d.segments ?? []);
      })
      .catch(() => {
        if (!cancelled) setSegments([]);
      });
    return () => {
      cancelled = true;
    };
  }, [activeRecId]);

  const currentSegment =
    state && segments.length
      ? segmentAt(segments, state.offsetInRecording)
      : null;

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
                <NowPlaying
                  detail={detail}
                  state={state}
                  currentSegment={currentSegment}
                  segments={segments}
                  onSeek={scrub ? handleScrubSeek : undefined}
                />

                {DEV && (
                  <button
                    onClick={() => setScrub((v) => !v)}
                    className="mt-3 text-[10px] tracking-[0.08em] px-2.5 py-1 rounded border transition-colors"
                    style={{
                      borderColor: scrub ? "#7d5fb0" : "#222",
                      color: scrub ? "#7d5fb0" : "#555",
                    }}
                  >
                    🛠 SCRUB {scrub ? "ON — click ribbon to jump" : "off"}
                  </button>
                )}

                <UpNext
                  segments={segments}
                  positionSec={state?.offsetInRecording ?? 0}
                  hasSegmentData={segments.length > 0}
                />

                <button
                  onClick={() => (started ? tuneOut() : tuneIn())}
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
                  onToggleDJ={() => setSkipFlags({ skipDJ: !skipDJ })}
                  onToggleAds={() => setSkipFlags({ skipAds: !skipAds })}
                />
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
