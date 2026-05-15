import type { Recording } from "@/lib/broadcastClock";

export type StationSummary = {
  id: string;
  name: string;
  freq: string;
  genre: string;
  color: string;
  sortOrder: number;
};

export type StationDetail = {
  station: {
    id: string;
    name: string;
    freq: string;
    genre: string;
    color: string;
  };
  recordings: Recording[];
  totalDuration: number;
  epoch: number;
};

export function fmtTime(secs: number): string {
  if (!isFinite(secs) || secs < 0) return "0:00";
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
