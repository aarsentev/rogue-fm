"use client";

import { useState } from "react";
import { useSettings } from "@/lib/settings";

type Match = {
  title: string;
  artist: string | null;
  album: string | null;
  score: number | null;
};

type Outcome =
  | { kind: "matched"; match: Match }
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
      match: {
        title: j.title,
        artist: j.artist ?? null,
        album: j.album ?? null,
        score: j.score ?? null,
      },
    };
  }
  if (j.acousticScore) return { kind: "acoustic", score: j.acousticScore };
  return { kind: "nomatch" };
}

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
      const res = await fetch(`/api/segments/${segmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trackTitle: m.title,
          trackArtist: m.artist,
          trackAlbum: m.album,
        }),
      });
      if (!res.ok) throw new Error("save failed");
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

  // --- terminal inline states -------------------------------------------

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
  if (
    phase.name === "result" &&
    phase.outcome.kind !== "matched"
  ) {
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
    const saving = phase.name === "saving";
    return (
      <>
        <p className="text-[14px] text-[#888] italic mb-7 truncate">
          Match found — confirm below
        </p>
        <ConfirmModal
          match={match}
          accent={accent}
          saving={saving}
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

function ConfirmModal({
  match,
  accent,
  saving,
  onSave,
  onRetry,
  onAbort,
}: {
  match: Match;
  accent: string;
  saving: boolean;
  onSave: () => void;
  onRetry: () => void;
  onAbort: () => void;
}) {
  const rows: [string, string][] = [
    ["Title", match.title || "—"],
    ["Artist", match.artist || "—"],
    ["Album", match.album || "—"],
  ];
  const pct = match.score != null ? Math.round(match.score * 100) : null;

  return (
    <div
      onClick={saving ? undefined : onAbort}
      className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center pt-28 px-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[420px] bg-[#0f0f0f] border border-[#1e1e1e] rounded-2xl p-6"
      >
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="text-[13px] font-semibold text-[#ccc] tracking-[0.08em] uppercase">
            Is this the right track?
          </h2>
          {pct != null && (
            <span className="text-[11px] text-[#555]">{pct}% match</span>
          )}
        </div>

        <dl className="mb-6">
          {rows.map(([label, value]) => (
            <div
              key={label}
              className="flex gap-4 py-2 border-b border-[#161616] last:border-0"
            >
              <dt className="text-[11px] text-[#555] uppercase tracking-[0.08em] w-16 shrink-0 pt-0.5">
                {label}
              </dt>
              <dd className="text-[14px] text-[#ddd] flex-1 break-words">
                {value}
              </dd>
            </div>
          ))}
        </dl>

        <div className="flex flex-col gap-2">
          <button
            onClick={onSave}
            disabled={saving}
            className="w-full py-2.5 rounded-xl text-[13px] font-medium transition-colors disabled:opacity-60"
            style={{ background: accent, color: "#0a0a0a" }}
          >
            {saving ? "Saving…" : "Yes, save"}
          </button>
          <button
            onClick={onRetry}
            disabled={saving}
            className="w-full py-2.5 rounded-xl text-[13px] border border-[#242424] text-[#aaa] hover:bg-[#141414] transition-colors disabled:opacity-60"
          >
            Not quite, try again
          </button>
          <button
            onClick={onAbort}
            disabled={saving}
            className="w-full py-2 rounded-xl text-[12px] text-[#555] hover:text-[#888] transition-colors disabled:opacity-60"
          >
            No, abort
          </button>
        </div>
      </div>
    </div>
  );
}
