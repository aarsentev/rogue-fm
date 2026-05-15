"use client";

import { useEffect, useRef } from "react";
import type { ClockState } from "./broadcastClock";
import type { StationDetail } from "./types";

export type MediaSessionHandlers = {
  onPlay: () => void;
  onPause: () => void;
  onNext: () => void;
  onPrev: () => void;
};

function hasMediaSession(): boolean {
  return typeof navigator !== "undefined" && "mediaSession" in navigator;
}

export function useMediaSession(
  detail: StationDetail | null,
  state: ClockState | null,
  started: boolean,
  handlers: MediaSessionHandlers,
): void {
  // Keep latest handlers without rebinding the actions every render.
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  // Bind action handlers once on mount.
  useEffect(() => {
    if (!hasMediaSession()) return;
    const ms = navigator.mediaSession;
    ms.setActionHandler("play", () => handlersRef.current.onPlay());
    ms.setActionHandler("pause", () => handlersRef.current.onPause());
    ms.setActionHandler("nexttrack", () => handlersRef.current.onNext());
    ms.setActionHandler("previoustrack", () => handlersRef.current.onPrev());
    return () => {
      ms.setActionHandler("play", null);
      ms.setActionHandler("pause", null);
      ms.setActionHandler("nexttrack", null);
      ms.setActionHandler("previoustrack", null);
    };
  }, []);

  // Update metadata when station/recording changes.
  useEffect(() => {
    if (!hasMediaSession() || !detail || !state) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: state.recording.displayName ?? state.recording.filename,
      artist: detail.station.name,
      album: `${detail.station.freq} FM · ${detail.station.genre}`,
    });
  }, [detail, state?.recording.id]);

  // Reflect playback state.
  useEffect(() => {
    if (!hasMediaSession()) return;
    navigator.mediaSession.playbackState = started ? "playing" : "paused";
  }, [started]);

  // Update progress so OS UI can show position.
  useEffect(() => {
    if (!hasMediaSession() || !state) return;
    try {
      navigator.mediaSession.setPositionState({
        duration: state.recording.duration,
        position: Math.min(state.offsetInRecording, state.recording.duration),
        playbackRate: 1,
      });
    } catch {
      // ignore (some browsers/conditions reject the call)
    }
  }, [state?.offsetInRecording, state?.recording.id]);
}
