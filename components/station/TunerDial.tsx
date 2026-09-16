"use client";

import { useMemo } from "react";
import type { StationSummary } from "@/lib/types";

const BAND_MIN = 88;
const BAND_MAX = 108;

// A station with no frequency still needs a spot on the dial. Derive a stable
// pseudo-random one from its id so it doesn't jump around between renders.
function hashToFreq(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  const span = (BAND_MAX - BAND_MIN - 1) * 10; // 0.1 MHz steps, small margin
  return BAND_MIN + 0.5 + (h % span) / 10;
}

function freqOf(s: StationSummary): number {
  const f = parseFloat(s.freq);
  return Number.isFinite(f) ? f : hashToFreq(s.id);
}

const posOf = (freq: number) =>
  ((freq - BAND_MIN) / (BAND_MAX - BAND_MIN)) * 100;

type Props = {
  stations: StationSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export function TunerDial({ stations, selectedId, onSelect }: Props) {
  // Minor tick every 0.5 MHz, major (labelled) every 2 MHz.
  const ticks = useMemo(() => {
    const steps = (BAND_MAX - BAND_MIN) * 2;
    return Array.from({ length: steps + 1 }, (_, i) => {
      const f = BAND_MIN + i * 0.5;
      return { f, major: i % 4 === 0 };
    });
  }, []);

  const marks = stations.map((s) => ({ s, freq: freqOf(s) }));
  const active = marks.find((m) => m.s.id === selectedId) ?? null;

  return (
    <div className="w-full max-w-[760px] mx-auto mt-1 select-none">
      <div className="relative h-[64px] rounded-lg border border-line bg-inset overflow-hidden">
        {/* dim band ticks */}
        {ticks.map(({ f, major }) => (
          <span
            key={f}
            className="absolute bottom-0"
            style={{
              left: `${posOf(f)}%`,
              width: 1,
              height: major ? 16 : 9,
              transform: "translateX(-50%)",
              background: major
                ? "var(--color-ink-6)"
                : "var(--color-ink-7)",
            }}
          />
        ))}

        {/* major-tick frequency labels */}
        {ticks
          .filter((t) => t.major)
          .map(({ f }) => (
            <span
              key={`l${f}`}
              className="absolute bottom-[18px] text-[9px] tabular-nums text-ink-6"
              style={{ left: `${posOf(f)}%`, transform: "translateX(-50%)" }}
            >
              {f}
            </span>
          ))}

        {/* lit station stripes */}
        {marks.map(({ s, freq }) => {
          const isActive = s.id === selectedId;
          return (
            <button
              key={s.id}
              onClick={() => onSelect(s.id)}
              aria-label={`Tune to ${s.name}, ${freq.toFixed(1)} FM`}
              title={`${s.name} · ${freq.toFixed(1)}`}
              className="absolute bottom-0 top-0 flex items-end justify-center"
              style={{
                left: `${posOf(freq)}%`,
                width: 22,
                transform: "translateX(-50%)",
                cursor: "pointer",
              }}
            >
              <span
                className="block rounded-t-sm transition-all"
                style={{
                  width: isActive ? 3 : 2,
                  height: isActive ? 40 : 26,
                  background: s.color,
                  opacity: isActive ? 1 : 0.7,
                  boxShadow: isActive
                    ? `0 0 10px 1px ${s.color}, 0 0 3px ${s.color}`
                    : "none",
                }}
              />
            </button>
          );
        })}

        {/* needle + readout at the active station */}
        {active && (
          <div
            className="absolute top-0 flex flex-col items-center pointer-events-none"
            style={{
              left: `${posOf(active.freq)}%`,
              transform: "translateX(-50%)",
            }}
          >
            <span
              className="mt-1 text-[10px] font-semibold tabular-nums leading-none"
              style={{ color: active.s.color }}
            >
              {active.freq.toFixed(active.freq % 1 === 0 ? 0 : 1)}
            </span>
            <span
              style={{
                width: 0,
                height: 0,
                marginTop: 2,
                borderLeft: "4px solid transparent",
                borderRight: "4px solid transparent",
                borderTop: `5px solid ${active.s.color}`,
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
