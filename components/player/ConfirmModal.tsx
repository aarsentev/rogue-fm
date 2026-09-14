"use client";

import { Modal } from "@/components/ui/Modal";
import type { Match } from "./identifyClient";

// The "Is this the right track?" confirmation over a match: shows the fetched
// details plus the match confidence, and the save / retry / abort choices.
export function ConfirmModal({
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
    <Modal onClose={onAbort} dismissable={!saving}>
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="text-[13px] font-semibold text-ink-2 tracking-[0.08em] uppercase">
          Is this the right track?
        </h2>
        {pct != null && (
          <span className="text-[11px] text-ink-5">{pct}% match</span>
        )}
      </div>

      <dl className="mb-6">
        {rows.map(([label, value]) => (
          <div
            key={label}
            className="flex gap-4 py-2 border-b border-line-soft last:border-0"
          >
            <dt className="text-[11px] text-ink-5 uppercase tracking-[0.08em] w-16 shrink-0 pt-0.5">
              {label}
            </dt>
            <dd className="text-[14px] text-ink-2 flex-1 break-words">
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
          style={{ background: accent, color: "var(--color-on-accent)" }}
        >
          {saving ? "Saving…" : "Yes, save"}
        </button>
        <button
          onClick={onRetry}
          disabled={saving}
          className="w-full py-2.5 rounded-xl text-[13px] border border-line-strong text-ink-2 hover:bg-raised transition-colors disabled:opacity-60"
        >
          Not quite, try again
        </button>
        <button
          onClick={onAbort}
          disabled={saving}
          className="w-full py-2 rounded-xl text-[12px] text-ink-5 hover:text-ink-3 transition-colors disabled:opacity-60"
        >
          No, abort
        </button>
      </div>
    </Modal>
  );
}
