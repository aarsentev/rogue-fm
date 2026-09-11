"use client";

import { useEffect, useState } from "react";

export type Recording = {
  id: string;
  filename: string;
  displayName: string | null;
  duration: number;
  sortOrder: number;
};

export type StationTimeline = {
  recordings: Recording[];
  totalDuration: number;
};

export type ClockState = {
  recording: Recording;
  recordingIndex: number;
  offsetInRecording: number;
  globalElapsed: number;
};

export function getUpcomingRecordings(
  timeline: StationTimeline,
  currentIndex: number,
  count: number,
): Recording[] {
  const out: Recording[] = [];
  if (timeline.recordings.length === 0) return out;
  for (let i = 1; i <= count; i++) {
    const idx = (currentIndex + i) % timeline.recordings.length;
    out.push(timeline.recordings[idx]);
  }
  return out;
}

export function getStationState(
  timeline: StationTimeline,
  epoch: number,
  now: number = Date.now(),
): ClockState | null {
  if (timeline.recordings.length === 0 || timeline.totalDuration <= 0) {
    return null;
  }
  const elapsed = ((now - epoch) / 1000) % timeline.totalDuration;
  let acc = 0;
  for (let i = 0; i < timeline.recordings.length; i++) {
    const r = timeline.recordings[i];
    if (elapsed < acc + r.duration) {
      return {
        recording: r,
        recordingIndex: i,
        offsetInRecording: elapsed - acc,
        globalElapsed: elapsed,
      };
    }
    acc += r.duration;
  }
  // floating-point fallback
  return {
    recording: timeline.recordings[0],
    recordingIndex: 0,
    offsetInRecording: 0,
    globalElapsed: 0,
  };
}

export function useBroadcastClock(
  timeline: StationTimeline | null,
  epoch: number | null,
): ClockState | null {
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  if (!timeline || epoch === null) return null;
  return getStationState(timeline, epoch);
}
