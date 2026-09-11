"use client";

import { useState } from "react";
import { useSettings } from "@/lib/settings";
import { identify, saveTrack, type Match, type Outcome } from "./identifyClient";
import { ConfirmModal } from "./ConfirmModal";

type Phase =
  | { name: "idle" }
  | { name: "listening" }
  | { name: "result"; outcome: Outcome }
  | { name: "saving"; match: Match }
  | { name: "saved"; label: string };

// Occupies the Now Playing subtitle slot for an UNIDENTIFIED music/talkover
// segment. Shazam off → an honest "Unidentified track" line; Shazam on → the
// identify affordance, its listening/reveal states, and a confirmation modal on
// a match. Nothing is written until the user confirms with "Yes, save".
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
        name: "result",
        outcome: { kind: "error", message: "No segment to identify" },
      });
      return;
    }
    setPhase({ name: "listening" });
    try {
      setPhase({ name: "result", outcome: await identify(segmentId) });
    } catch {
      setPhase({
        name: "result",
        outcome: { kind: "error", message: "Identification failed" },
      });
    }
  };

  const save = async (m: Match) => {
    if (!segmentId) return;
    setPhase({ name: "saving", match: m });
    try {
      await saveTrack(segmentId, m);
      setPhase({
        name: "saved",
        label: `${m.artist ? m.artist + " — " : ""}${m.title}`,
      });
    } catch {
      setPhase({
        name: "result",
        outcome: { kind: "error", message: "Couldn't save" },
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

  if (phase.name === "saved") {
    return (
      <p className="text-[14px] mb-7 truncate" style={{ color: accent }}>
        {phase.label}
        <span className="text-[10px] text-[#3a3a3a] tracking-[0.08em] uppercase ml-2.5">
          saved
        </span>
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

  // Non-match results render inline with a retry.
  if (phase.name === "result" && phase.outcome.kind !== "matched") {
    const o = phase.outcome;
    return (
      <div className="flex items-center gap-2.5 mb-7 min-h-[21px]">
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

  // A match (or a save in progress) → the confirmation modal.
  const match =
    phase.name === "saving"
      ? phase.match
      : phase.name === "result" && phase.outcome.kind === "matched"
        ? phase.outcome.match
        : null;

  if (match) {
    return (
      <>
        <p className="text-[14px] text-[#888] italic mb-7 truncate">
          Match found — confirm below
        </p>
        <ConfirmModal
          match={match}
          accent={accent}
          saving={phase.name === "saving"}
          onSave={() => save(match)}
          onRetry={run}
          onAbort={() => setPhase({ name: "idle" })}
        />
      </>
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
