"use client";

import { useEffect } from "react";
import { useSettings, applyTheme } from "@/lib/settings";

// Keeps <html data-theme> in step with the persisted lightMode setting. The
// initial value is set pre-paint by an inline script in the layout (no FOUC);
// this handles later toggles and hydration. Renders nothing.
export function ThemeSync() {
  const { lightMode } = useSettings();
  useEffect(() => {
    applyTheme(lightMode);
  }, [lightMode]);
  return null;
}
