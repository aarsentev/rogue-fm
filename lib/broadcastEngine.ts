"use client";

import { useSyncExternalStore } from "react";
import { getPlayer } from "./player";
import { getStationState } from "./broadcastClock";
import { skipTarget, type Seg } from "./skipLogic";
import type { StationDetail } from "./types";

/**
 * Module-level broadcast engine. Client-side navigation keeps modules alive,
 * so playback survives route changes (Home -> Library) instead of dying with
 * the page component. Pages observe via useBroadcast() and command via the
 * exported actions; nobody owns playback state in component state anymore.
 */

export type BroadcastState = {
  started: boolean;
  detail: StationDetail | null;
  segments: Seg[];
  skipDJ: boolean;
  skipAds: boolean;
  epochOverride: number | null;
};

let state: BroadcastState = {
  started: false,
  detail: null,
  segments: [],
  skipDJ: false,
  skipAds: false,
  epochOverride: null,
};

const listeners = new Set<() => void>();
let syncTimer: ReturnType<typeof setInterval> | null = null;
let skipTimer: ReturnType<typeof setInterval> | null = null;

function emit() {
  for (const l of listeners) l();
}

function set(patch: Partial<BroadcastState>) {
  state = { ...state, ...patch };
  emit();
}

function evalAndSync() {
  const { detail, epochOverride } = state;
  if (!detail) return;
  const s = getStationState(
    { recordings: detail.recordings, totalDuration: detail.totalDuration },
    epochOverride ?? detail.epoch,
  );
  if (s) getPlayer().loadAndSync(s.recording.id, s.offsetInRecording);
}

function skipTick() {
  const { skipDJ, skipAds, segments } = state;
  if ((!skipDJ && !skipAds) || segments.length === 0) return;
  const player = getPlayer();
  const pos = player.getPositionSec();
  if (pos == null) return;
  const target = skipTarget(segments, pos, { skipDJ, skipAds });
  if (target != null) player.seekTo(target);
}

function startLoops() {
  stopLoops();
  evalAndSync();
  getPlayer().setOnEnded(evalAndSync);
  syncTimer = setInterval(evalAndSync, 3000);
  skipTimer = setInterval(skipTick, 500);
}

function stopLoops() {
  if (syncTimer) clearInterval(syncTimer);
  if (skipTimer) clearInterval(skipTimer);
  syncTimer = null;
  skipTimer = null;
  getPlayer().setOnEnded(null);
}

export function tuneIn() {
  set({ started: true });
  if (state.detail) startLoops();
}

export function tuneOut() {
  stopLoops();
  getPlayer().unload();
  set({ started: false });
}

export function setStationDetail(detail: StationDetail | null) {
  // On station switch the old audio keeps running until the new detail
  // arrives — loadAndSync then crossfades through the static burst.
  set({ detail, epochOverride: null, segments: [] });
  if (state.started && detail) startLoops();
  else if (!detail) stopLoops();
}

export function setSegments(segments: Seg[]) {
  set({ segments });
}

export function setSkipFlags(flags: { skipDJ?: boolean; skipAds?: boolean }) {
  set(flags);
}

export function overrideEpoch(epochMs: number | null) {
  set({ epochOverride: epochMs });
  if (state.started) evalAndSync();
}

export function useBroadcast(): BroadcastState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
    () => state,
  );
}
