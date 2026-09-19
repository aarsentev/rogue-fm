"use client";

import { useSyncExternalStore } from "react";

/**
 * Persisted client-side preferences. Kept in localStorage and exposed both
 * imperatively (getSettings — for the audio engine) and reactively
 * (useSettings — for UI). Not tied to any station or broadcast state.
 */
export type Settings = {
  // Retro-radio flourishes: tuning static on tune-in/transitions and a
  // mechanical click when tuning out. On by default to preserve the
  // long-standing static behaviour.
  classicMode: boolean;
  // Acoustic-fingerprint track identification. Off by default — it requires
  // an AcoustID API key and is not wired to a backend yet.
  shazamMode: boolean;
  // Interface theme. Off by default — the app is dark-first.
  lightMode: boolean;
  // Audio-reactive equalizer bars on the now-playing panel.
  equalizer: boolean;
  // Let the timeline and Up next be clicked to jump to a segment. Off keeps
  // the broadcast strictly live.
  seekMode: boolean;
};

const STORAGE_KEY = "roguefm.settings";
const DEFAULTS: Settings = {
  classicMode: true,
  shazamMode: false,
  lightMode: false,
  equalizer: false,
  seekMode: false,
};

// Apply the theme to <html> so the CSS token overrides take effect. Also run
// verbatim as an inline pre-paint script in the document head (see layout) to
// avoid a flash of the wrong theme; keep it self-contained.
export function applyTheme(lightMode: boolean) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = lightMode ? "light" : "dark";
}

function load(): Settings {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    return DEFAULTS;
  }
}

let settings: Settings = load();
const listeners = new Set<() => void>();

function persist() {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // storage unavailable (private mode / blocked) — keep in-memory only.
  }
}

export function getSettings(): Settings {
  return settings;
}

export function setSettings(patch: Partial<Settings>) {
  settings = { ...settings, ...patch };
  persist();
  if ("lightMode" in patch) applyTheme(settings.lightMode);
  for (const l of listeners) l();
}

export function useSettings(): Settings {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => settings,
    () => DEFAULTS,
  );
}
