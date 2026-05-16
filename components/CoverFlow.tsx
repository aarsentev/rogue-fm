"use client";

import { useEffect, useRef } from "react";
import type { StationSummary } from "@/lib/types";
import { Cover } from "./Cover";

type Props = {
  stations: StationSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

const CENTER_SIZE = 220;
const SPACING = 170;
const DRAG_THRESHOLD = 60;

export function CoverFlow({ stations, selectedId, onSelect }: Props) {
  const dragStart = useRef<number | null>(null);
  const dragHandled = useRef(false);

  const selectedIndex = stations.findIndex((s) => s.id === selectedId);

  const move = (delta: number) => {
    if (stations.length === 0 || selectedIndex < 0) return;
    const next =
      stations[
        (selectedIndex + delta + stations.length) % stations.length
      ];
    if (next) onSelect(next.id);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        move(-1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        move(1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const onPointerDown = (e: React.PointerEvent) => {
    dragStart.current = e.clientX;
    dragHandled.current = false;
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (dragStart.current === null || dragHandled.current) return;
    const dx = e.clientX - dragStart.current;
    if (Math.abs(dx) > DRAG_THRESHOLD) {
      move(dx < 0 ? 1 : -1);
      dragHandled.current = true;
    }
  };
  const onPointerEnd = () => {
    dragStart.current = null;
  };

  if (stations.length === 0) {
    return <div className="h-[300px]" />;
  }

  return (
    <div
      className="relative h-[300px] w-full select-none touch-pan-y overflow-hidden"
      style={{ perspective: 1100 }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerLeave={onPointerEnd}
    >
      {stations.map((s, i) => {
        const offset = i - selectedIndex;
        const abs = Math.abs(offset);
        if (abs > 2) return null;

        const isCenter = offset === 0;
        const scale = isCenter ? 1 : abs === 1 ? 0.66 : 0.5;
        const rotateY = isCenter ? 0 : offset < 0 ? 38 : -38;
        const opacity = isCenter ? 1 : abs === 1 ? 0.5 : 0.25;
        const translateX = offset * SPACING;
        const z = 10 - abs;

        return (
          <button
            key={s.id}
            onClick={() => !isCenter && onSelect(s.id)}
            aria-label={`${s.name} ${s.freq} FM`}
            className="absolute top-1/2 left-1/2 transition-all duration-[450ms] ease-out"
            style={{
              transform: `translate(-50%, -50%) translateX(${translateX}px) scale(${scale}) rotateY(${rotateY}deg)`,
              opacity,
              zIndex: z,
              cursor: isCenter ? "default" : "pointer",
              filter: isCenter
                ? "none"
                : "brightness(0.65) saturate(0.85)",
            }}
          >
            <div
              style={{
                boxShadow: isCenter
                  ? `0 24px 60px -12px ${s.color}66`
                  : "0 16px 40px -16px #000",
                borderRadius: 16,
              }}
            >
              <Cover
                freq={s.freq}
                name={s.name}
                color={s.color}
                size={CENTER_SIZE}
                rounded={16}
              />
            </div>
          </button>
        );
      })}
    </div>
  );
}
