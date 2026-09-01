"use client";

import { useEffect, useState } from "react";
import { useSettings, setSettings } from "@/lib/settings";
import { Toggle } from "./Toggle";

const ACCENT = "#c0392b";

export function SettingsButton() {
  const [open, setOpen] = useState(false);
  const { classicMode } = useSettings();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-[11px] text-[#666] hover:text-white transition-colors"
      >
        Settings
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center pt-28 px-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[420px] bg-[#0f0f0f] border border-[#1e1e1e] rounded-2xl p-6"
          >
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-[13px] font-semibold text-[#ccc] tracking-[0.08em] uppercase">
                Settings
              </h2>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close settings"
                className="text-[#555] hover:text-white text-xl leading-none -mt-1"
              >
                ×
              </button>
            </div>
            <p className="text-[11px] text-[#444] mb-6">
              personal build · local files
            </p>

            <button
              onClick={() => setSettings({ classicMode: !classicMode })}
              className="w-full flex items-center gap-3.5 px-4 py-3.5 rounded-xl border transition-colors text-left"
              style={{
                background: classicMode ? ACCENT + "14" : "#0d0d0d",
                borderColor: classicMode ? ACCENT + "40" : "#181818",
              }}
            >
              <Toggle on={classicMode} color={ACCENT} />
              <span className="flex-1">
                <span className="block text-[13px] text-[#ccc]">
                  Classic mode
                </span>
                <span className="block text-[11px] text-[#555] mt-0.5">
                  Tuning static when you tune in, and a click when you tune out.
                </span>
              </span>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
