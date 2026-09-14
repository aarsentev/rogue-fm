"use client";

import { Toggle } from "@/components/ui/Toggle";

type Props = {
  color: string;
  skipDJ: boolean;
  skipAds: boolean;
  onToggleDJ: () => void;
  onToggleAds: () => void;
};

export function SkipControls({
  color,
  skipDJ,
  skipAds,
  onToggleDJ,
  onToggleAds,
}: Props) {
  const items = [
    { label: "Skip comments", val: skipDJ, onClick: onToggleDJ },
    { label: "Skip ads", val: skipAds, onClick: onToggleAds },
  ];

  return (
    <div className="flex gap-3">
      {items.map((it) => (
        <button
          key={it.label}
          onClick={it.onClick}
          className="flex items-center gap-2.5 px-[18px] py-2.5 rounded-[10px] cursor-pointer text-[13px] border transition-colors"
          style={{
            background: it.val ? color + "14" : "var(--color-surface)",
            borderColor: it.val ? color + "40" : "var(--color-line-soft)",
            color: it.val ? color : "var(--color-ink-6)",
          }}
        >
          <Toggle on={it.val} color={color} />
          {it.label}
        </button>
      ))}
    </div>
  );
}
