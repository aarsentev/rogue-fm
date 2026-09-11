"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useBroadcast, tuneOut } from "@/lib/broadcastEngine";

/**
 * Floating dock shown on every page except the player itself while the
 * broadcast is on air. Reminds you what's playing and lets you kill it.
 */
export function MiniDock() {
  const pathname = usePathname();
  const { started, detail } = useBroadcast();

  if (!started || !detail || pathname === "/") return null;

  const st = detail.station;
  return (
    <div className="fixed bottom-5 right-5 z-50 flex items-center gap-3 px-4 py-2.5 rounded-xl border border-[#222] bg-[#0d0d0d]/95 backdrop-blur shadow-[0_8px_30px_rgba(0,0,0,0.6)]">
      <span
        className="w-2 h-2 rounded-full animate-pulse shrink-0"
        style={{ background: st.color }}
      />
      <Link href="/" className="leading-tight group">
        <p className="text-[12px] text-white m-0 group-hover:underline">
          {st.name}
        </p>
        <p className="text-[10px] text-[#555] m-0">{st.freq} FM · on air</p>
      </Link>
      <button
        onClick={tuneOut}
        title="Tune out"
        className="ml-1 w-7 h-7 rounded border border-[#333] text-[#999] hover:text-white hover:border-[#555] text-[11px] leading-none"
      >
        ■
      </button>
    </div>
  );
}
