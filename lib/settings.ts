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
};

const STORAGE_KEY = "roguefm.settings";
const DEFAULTS: Settings = { classicMode: true };

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
