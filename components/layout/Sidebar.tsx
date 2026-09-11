"use client";

import type { StationSummary } from "@/lib/types";

type Props = {
  stations: StationSummary[];
  selectedId: string | null;
  activeRecordingName: string | null;
  onSelect: (id: string) => void;
};

export function Sidebar({ stations, selectedId, activeRecordingName, onSelect }: Props) {
  return (
    <aside className="w-[250px] border-r border-[#141414] py-5 shrink-0">
      <p className="text-[10px] text-[#333] tracking-[0.12em] px-5 mb-2.5 uppercase">
        Stations
      </p>
      {stations.map((s) => {
        const active = s.id === selectedId;
        const subtitle = active ? activeRecordingName ?? s.genre : s.genre;
        return (
          <button
            key={s.id}
            onClick={() => onSelect(s.id)}
            className="w-full px-5 py-2.5 cursor-pointer text-left flex items-center gap-3 border-l-2 transition-colors"
            style={{
              background: active ? "#111" : "transparent",
              borderLeftColor: active ? s.color : "transparent",
            }}
          >
            {s.logoPath ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/api/logo/${s.id}`}
                alt=""
                width={36}
                height={36}
                className="rounded-lg shrink-0 object-cover"
                style={{
                  background: s.color,
                  border: `1px solid ${active ? s.color + "55" : "#1a1a1a"}`,
                }}
              />
            ) : (
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border"
                style={{
                  background: active ? s.color + "20" : "#141414",
                  borderColor: active ? s.color + "33" : "#1a1a1a",
                }}
              >
                <span
                  className="text-[9px] font-bold tracking-wider"
                  style={{ color: active ? s.color : "#444" }}
                >
                  {s.freq}
                </span>
              </div>
            )}
            <div className="overflow-hidden flex-1">
              <p
                className="text-[13px] font-medium m-0 truncate"
                style={{ color: active ? "#fff" : "#666" }}
              >
                {s.name}
              </p>
              <p className="text-[11px] text-[#3a3a3a] m-0 truncate">{subtitle}</p>
            </div>
            {active && (
              <div className="ml-auto flex gap-[2px] items-end shrink-0">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className={`w-[2px] rounded-[1px] eq-bar eq-bar-${i}`}
                    style={{ background: s.color, height: 8 }}
                  />
                ))}
              </div>
            )}
          </button>
        );
      })}
    </aside>
  );
}
