export function Topbar() {
  return (
    <header className="px-8 py-4 border-b border-[#141414] flex items-center gap-3">
      <div className="w-[7px] h-[7px] rounded-full bg-[#c0392b] animate-pulse" />
      <span className="text-xs font-semibold tracking-[0.15em] text-[#666]">
        ROGUE FM
      </span>
      <span className="ml-auto text-[11px] text-[#333]">
        personal build · local files
      </span>
    </header>
  );
}
