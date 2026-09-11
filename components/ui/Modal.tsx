"use client";

import { useEffect } from "react";

/**
 * Centered dark modal card over a dimmed backdrop. Clicking the backdrop or
 * pressing Escape calls `onClose` when `dismissable` (the default). Pass
 * `dismissable={false}` to lock it open (e.g. mid-save).
 */
export function Modal({
  onClose,
  dismissable = true,
  maxWidth = 420,
  children,
}: {
  onClose: () => void;
  dismissable?: boolean;
  maxWidth?: number;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!dismissable) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dismissable, onClose]);

  return (
    <div
      onClick={dismissable ? onClose : undefined}
      className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center pt-28 px-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth }}
        className="w-full bg-[#0f0f0f] border border-[#1e1e1e] rounded-2xl p-6"
      >
        {children}
      </div>
    </div>
  );
}
