"use client";

import { useState } from "react";
import { useSettings } from "@/lib/settings";

type Outcome =
  | { kind: "matched"; artist: string; title: string }
  | { kind: "acoustic"; score: number }
  | { kind: "nomatch" };

// TEMP stub — cycles through the three outcomes so every visual state is
// reviewable without hunting for the right kind of segment. Replace with a
// POST to /api/segments/[id]/identify once that route exists; the surrounding
// state machine (idle → listening → done) stays exactly as-is.
let stubTurn = 0;
function stubIdentify(): Promise<Outcome> {
  const outcomes: Outcome[] = [
    { kind: "matched", artist: "Sample Artist", title: "Sample Song" },
    { kind: "acoustic", score: 0.9 },
    { kind: "nomatch" },
  ];
  const pick = outcomes[stubTurn++ % outcomes.length];
  return new Promise((r) => setTimeout(() => r(pick), 1600));
}

type Phase =
  | { name: "idle" }
  | { name: "listening" }
  | { name: "done"; outcome: Outcome };

// Occupies the Now Playing subtitle slot for an UNIDENTIFIED music/talkover
// segment. With Shazam mode off it's just an honest "Unidentified track" line;
// with it on, it offers the identify affordance and its listening/reveal states.
export function TrackIdentify({ accent }: { accent: string }) {
  const { shazamMode } = useSettings();
  const [phase, setPhase] = useState<Phase>({ name: "idle" });

  const run = async () => {
    setPhase({ name: "listening" });
    const outcome = await stubIdentify();
    setPhase({ name: "done", outcome });
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
        <button
          onClick={run}
          aria-label="Identify again"
          title="Identify again"
          className="text-[12px] text-[#444] hover:text-[#999] transition-colors shrink-0"
        >
          ↻
        </button>
        <span className="text-[10px] text-[#333] tracking-[0.08em] uppercase shrink-0">
          preview
        </span>
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
