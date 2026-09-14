import Link from "next/link";
import { SettingsButton } from "@/components/settings/SettingsButton";

export function Topbar() {
  return (
    <header className="px-8 py-4 border-b border-line-soft flex items-center gap-3">
      <div className="w-[7px] h-[7px] rounded-full bg-accent animate-pulse" />
      <span className="text-xs font-semibold tracking-[0.15em] text-ink-4">
        ROGUE FM
      </span>
      <Link
        href="/library"
        className="ml-auto text-[11px] text-ink-4 hover:text-ink"
      >
        Library
      </Link>
      <SettingsButton />
      <span className="text-[11px] text-ink-7">
        personal build · local files
      </span>
    </header>
  );
}
