"use client";

import { useState } from "react";
import { useSettings, setSettings, type Settings } from "@/lib/settings";
import { Toggle } from "@/components/ui/Toggle";
import { Modal } from "@/components/ui/Modal";

const ACCENT = "var(--color-accent)";

type ToggleRow = {
  key: keyof Settings;
  label: string;
  description: string;
};

const ROWS: ToggleRow[] = [
  {
    key: "classicMode",
    label: "Classic mode",
    description:
      "Tuning static when you tune in, and a click when you tune out.",
  },
  {
    key: "shazamMode",
    label: "Shazam mode",
    description:
      "Enable automatic scanning of your track to provide additional information. An API key is required.",
  },
  {
    key: "lightMode",
    label: "Light mode",
    description: "Switch the interface to a light theme.",
  },
];

export function SettingsButton() {
  const [open, setOpen] = useState(false);
  const settings = useSettings();

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-[11px] text-ink-4 hover:text-ink transition-colors"
      >
        Settings
      </button>

      {open && (
        <Modal onClose={() => setOpen(false)}>
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-[13px] font-semibold text-ink-2 tracking-[0.08em] uppercase">
              Settings
            </h2>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close settings"
              className="text-ink-5 hover:text-ink text-xl leading-none -mt-1"
            >
              ×
            </button>
          </div>
          <p className="text-[11px] text-ink-6 mb-6">
            personal build · local files
          </p>

          {ROWS.map((row) => {
            const on = settings[row.key];
            return (
              <button
                key={row.key}
                onClick={() => setSettings({ [row.key]: !on })}
                className="w-full flex items-center gap-3.5 px-4 py-3.5 rounded-xl border transition-colors text-left mb-2 last:mb-0"
                style={{
                  background: on
                    ? "color-mix(in srgb, var(--color-accent) 8%, transparent)"
                    : "var(--color-inset)",
                  borderColor: on
                    ? "color-mix(in srgb, var(--color-accent) 25%, transparent)"
                    : "var(--color-line-soft)",
                }}
              >
                <Toggle on={on} color={ACCENT} />
                <span className="flex-1">
                  <span className="block text-[13px] text-ink-2">
                    {row.label}
                  </span>
                  <span className="block text-[11px] text-ink-5 mt-0.5">
                    {row.description}
                  </span>
                </span>
              </button>
            );
          })}
        </Modal>
      )}
    </>
  );
}
