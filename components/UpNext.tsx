"use client";

import type { Recording } from "@/lib/broadcastClock";
import { fmtTime } from "@/lib/types";

type Props = {
  items: Recording[];
};

export function UpNext({ items }: Props) {
  if (items.length === 0) return null;

  return (
    <div className="mt-10 mb-6">
      <p className="text-[10px] text-[#333] tracking-[0.1em] uppercase mb-2.5">
        Up next
      </p>
      {items.map((r, i) => (
        <div
          key={`${r.id}-${i}`}
          className="flex items-center gap-3.5 px-3.5 py-2 rounded-lg mb-0.5"
          style={{ background: i === 0 ? "#0f0f0f" : "transparent" }}
        >
          <span className="text-[11px] text-[#2e2e2e] w-3.5 text-center">
            {i + 1}
          </span>
          <span
            className="text-[13px] flex-1 truncate"
            style={{ color: i === 0 ? "#aaa" : "#444" }}
          >
            {r.displayName ?? r.filename}
          </span>
          <span className="text-[11px] text-[#2a2a2a] ml-4">
            {fmtTime(r.duration)}
          </span>
        </div>
      ))}
    </div>
  );
}
