"use client";

import { useEffect, useRef, useState } from "react";
import { getStationState } from "@/lib/broadcastClock";
import { getPlayer } from "@/lib/player";
import { useMediaSession } from "@/lib/mediaSession";
import { skipTarget, segmentAt, type Seg } from "@/lib/skipLogic";
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
  const [segments, setSegments] = useState<Seg[]>([]);
  const [, setTick] = useState(0);
  const playerRef = useRef(getPlayer());

  // Dev-only scrub: shift a local epoch override so the broadcast clock
  // "time-travels" to a clicked position. Never persisted; prod stays live.
  const DEV = process.env.NODE_ENV !== "production";
  const [scrub, setScrub] = useState(false);
  const [epochOverride, setEpochOverride] = useState<number | null>(null);
  const epochOverrideRef = useRef<number | null>(null);

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
    epochOverrideRef.current = null;
    setEpochOverride(null);
    fetch(`/api/stations/${selectedId}`)
      .then((r) => r.json())
      .then(setDetail)
      .catch((e) => console.error("failed to load station detail", e));
  }, [selectedId]);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // Stop the broadcast when the home page unmounts (navigating to /library
  // or /editor). Otherwise the Howler singleton keeps playing in the
  // background and overlays the editor's own audio. To be replaced by a
  // global mini-player that persists state across routes (TBD task #8).
  useEffect(() => {
    const player = playerRef.current;
    return () => {
      player.unload();
    };
  }, []);

  useEffect(() => {
    if (!started || !detail) return;
    const player = playerRef.current;

    const evalAndSync = () => {
      const s = getStationState(
        { recordings: detail.recordings, totalDuration: detail.totalDuration },
        epochOverrideRef.current ?? detail.epoch,
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
    const newEpoch = Date.now() - globalElapsed * 1000;
    epochOverrideRef.current = newEpoch;
    setEpochOverride(newEpoch);
    playerRef.current.seekTo(offsetSec);
  };

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

  // Skip monitor: every 500ms, if the real playhead is inside a skippable
  // segment, jump past it. Independent of the broadcast-clock resync.
  useEffect(() => {
    if (!started) return;
    if (!skipDJ && !skipAds) return;
    if (segments.length === 0) return;
    const player = playerRef.current;
    const id = setInterval(() => {
      const pos = player.getPositionSec();
      if (pos == null) return;
      const target = skipTarget(segments, pos, { skipDJ, skipAds });
      if (target != null) player.seekTo(target);
    }, 500);
    return () => clearInterval(id);
  }, [started, skipDJ, skipAds, segments]);

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
