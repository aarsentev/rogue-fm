"use client";

import { useState } from "react";
import { useSettings } from "@/lib/settings";

type Outcome =
  | { kind: "matched"; artist: string; title: string }
  | { kind: "acoustic"; score: number }
  | { kind: "nomatch" }
  | { kind: "error"; message: string };

async function identify(segmentId: string): Promise<Outcome> {
  const res = await fetch(`/api/segments/${segmentId}/identify`, {
    method: "POST",
  });
  if (!res.ok) {
    let message = "Identification unavailable";
    try {
      const j = await res.json();
      if (j?.error) message = j.error;
    } catch {
      // keep the default message
    }
    return { kind: "error", message };
  }
  const j = await res.json();
  if (j.matched && j.title) {
    return {
      kind: "matched",
      artist: j.artist ?? "Unknown artist",
      title: j.title,
    };
  }
  if (j.acousticScore) return { kind: "acoustic", score: j.acousticScore };
  return { kind: "nomatch" };
}

type Phase =
  | { name: "idle" }
  | { name: "listening" }
  | { name: "done"; outcome: Outcome };

// Occupies the Now Playing subtitle slot for an UNIDENTIFIED music/talkover
// segment. With Shazam mode off it's just an honest "Unidentified track" line;
// with it on, it offers the identify affordance and its listening/reveal states.
// Result is NOT persisted — it's transient until the segment changes.
export function TrackIdentify({
  segmentId,
  accent,
}: {
  segmentId?: string;
  accent: string;
}) {
  const { shazamMode } = useSettings();
  const [phase, setPhase] = useState<Phase>({ name: "idle" });

  const run = async () => {
    if (!segmentId) {
      setPhase({
        name: "done",
        outcome: { kind: "error", message: "No segment to identify" },
      });
      return;
    }
    setPhase({ name: "listening" });
    try {
      const outcome = await identify(segmentId);
      setPhase({ name: "done", outcome });
    } catch {
      setPhase({
        name: "done",
        outcome: { kind: "error", message: "Identification failed" },
      });
    }
  };

  if (!shazamMode) {
    return (
      <p className="text-[14px] text-[#555] italic mb-7 truncate">
        Unidentified track
      </p>
    );
  }

  if (phase.name === "listening") {
    return (
      <div className="flex items-center gap-3 mb-7 h-[21px]">
        <span className="relative flex h-3 w-3">
          <span
            className="absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping"
            style={{ background: accent }}
          />
          <span
            className="relative inline-flex h-3 w-3 rounded-full"
            style={{ background: accent }}
          />
        </span>
        <span className="text-[14px] text-[#888]">Listening…</span>
      </div>
    );
  }

  if (phase.name === "done") {
    const o = phase.outcome;
    return (
      <div className="flex items-center gap-2.5 mb-7 min-h-[21px]">
        {o.kind === "matched" && (
          <span className="text-[14px] truncate" style={{ color: accent }}>
            {o.artist} — {o.title}
          </span>
        )}
        {o.kind === "acoustic" && (
          <span className="text-[14px] text-[#888] truncate">
            Recognized the sound — not in the database
          </span>
        )}
        {o.kind === "nomatch" && (
          <span className="text-[14px] text-[#666] truncate">
            Couldn&apos;t identify this one
          </span>
        )}
        {o.kind === "error" && (
          <span className="text-[14px] text-[#7d5a5a] truncate">
            {o.message}
          </span>
        )}
        <button
          onClick={run}
          aria-label="Identify again"
          title="Identify again"
          className="text-[12px] text-[#444] hover:text-[#999] transition-colors shrink-0"
        >
          ↻
        </button>
      </div>
    );
  }

  // idle
  return (
    <div className="flex items-center gap-3 mb-7">
      <span className="text-[14px] text-[#555] italic">Unidentified track</span>
      <button
        onClick={run}
        className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full border transition-colors"
        style={{ borderColor: accent + "40", color: accent }}
      >
        <span aria-hidden>◎</span> Identify
      </button>
    </div>
  );
}
