"use client";

import { useEffect, useState } from "react";
import { getStationState } from "@/lib/broadcast/clock";
import { getPlayer } from "@/lib/broadcast/player";
import {
  useBroadcast,
  tuneIn,
  tuneOut,
  setStationDetail,
  setSegments,
  setSkipFlags,
  overrideEpoch,
} from "@/lib/broadcast/engine";
import { useMediaSession } from "@/lib/broadcast/mediaSession";
import { segmentAt, type Seg } from "@/lib/broadcast/skipLogic";
import type { StationDetail, StationSummary } from "@/lib/types";
import { Topbar } from "@/components/layout/Topbar";
import { Sidebar } from "@/components/layout/Sidebar";
import { CoverFlow } from "@/components/station/CoverFlow";
import { NowPlaying } from "@/components/player/NowPlaying";
import { UpNext } from "@/components/player/UpNext";
import { SkipControls } from "@/components/player/SkipControls";

export default function Home() {
  const [stations, setStations] = useState<StationSummary[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { started, detail, segments, skipDJ, skipAds, epochOverride } =
    useBroadcast();
  const [, setTick] = useState(0);

  // Dev-only seek: shift a local epoch override so the broadcast clock
  // "time-travels" to a clicked position. Never persisted; prod stays live.
  const DEV = process.env.NODE_ENV !== "production";
  const [seek, setSeek] = useState(false);

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

  const handleSeek = (offsetSec: number) => {
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
    <div className="min-h-screen bg-canvas text-ink flex flex-col">
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
            <div className="text-ink-4 mt-8">Loading station…</div>
          ) : (
            <>
              <div className="max-w-[760px] w-full mt-6">
                <NowPlaying
                  detail={detail}
                  state={state}
                  currentSegment={currentSegment}
                  segments={segments}
                  onSeek={seek ? handleSeek : undefined}
                />

                {DEV && (
                  <button
                    onClick={() => setSeek((v) => !v)}
                    className="mt-3 text-[10px] tracking-[0.08em] px-2.5 py-1 rounded border transition-colors"
                    style={{
                      borderColor: seek ? "var(--color-dev)" : "var(--color-line)",
                      color: seek ? "var(--color-dev)" : "var(--color-ink-5)",
                    }}
                  >
                    🛠 SEEK {seek ? "ON — click ribbon or Up next to jump" : "off"}
                  </button>
                )}

                <UpNext
                  segments={segments}
                  positionSec={state?.offsetInRecording ?? 0}
                  hasSegmentData={segments.length > 0}
                  onSeek={seek ? handleSeek : undefined}
                />

                <button
                  onClick={() => (started ? tuneOut() : tuneIn())}
                  className="mt-8 px-6 py-3 rounded-lg border border-line-soft bg-surface hover:bg-raised text-sm text-ink-2 transition-colors"
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
