"use client";

import { useEffect, useRef, useState } from "react";
import { getPlayer } from "@/lib/broadcast/player";

const HEIGHT = 44; // px, tallest a bar can reach
const FLOOR = 3; // px, resting height when silent
const BAR_STEP = 9; // target px per bar (bar + gap) when fitting the width

/**
 * Audio-reactive equalizer. Fits as many bars as the container is wide so it
 * spans edge-to-edge, and drives their heights imperatively (no React re-render
 * per frame) from the shared analyser off the player. Falls back to a gentle
 * idle shimmer when there's no signal.
 */
export function Equalizer({ color }: { color: string }) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [count, setCount] = useState(32);

  // Fit the bar count to the available width so they fill the whole row.
  useEffect(() => {
    const el = rowRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      if (w > 0) setCount(Math.max(16, Math.floor(w / BAR_STEP)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const spans = rowRef.current
      ? (Array.from(rowRef.current.children) as HTMLElement[])
      : [];
    let raf = 0;
    let data: Uint8Array<ArrayBuffer> | null = null;

    const frame = (t: number) => {
      const analyser = getPlayer().getAnalyser();
      if (analyser) {
        if (!data || data.length !== analyser.frequencyBinCount) {
          data = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));
        }
        analyser.getByteFrequencyData(data);
        // Spread across the lower ~75% of the spectrum, where the musical
        // energy lives; the top bins are mostly empty.
        const usable = Math.floor(data.length * 0.75);
        for (let i = 0; i < spans.length; i++) {
          const lo = Math.floor((i / spans.length) * usable);
          const hi = Math.max(
            lo + 1,
            Math.floor(((i + 1) / spans.length) * usable),
          );
          let sum = 0;
          for (let j = lo; j < hi; j++) sum += data[j];
          const level = sum / (hi - lo) / 255; // 0..1
          const h = FLOOR + level * level * (HEIGHT - FLOOR); // squared = punchy
          spans[i].style.height = `${h}px`;
        }
      } else {
        // No analyser yet (not tuned in) — idle shimmer so it isn't dead flat.
        for (let i = 0; i < spans.length; i++) {
          const h = FLOOR + (Math.sin(t / 320 + i * 0.5) * 0.5 + 0.5) * 6;
          spans[i].style.height = `${h}px`;
        }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [count]);

  return (
    <div
      ref={rowRef}
      aria-hidden
      className="flex w-full items-end gap-[3px]"
      style={{ height: HEIGHT }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <span
          key={i}
          className="flex-1 rounded-[1px]"
          style={{
            height: FLOOR,
            background: color,
            transition: "height 80ms linear",
          }}
        />
      ))}
    </div>
  );
}
