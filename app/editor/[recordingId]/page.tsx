"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { use as usePromise } from "react";
import Link from "next/link";
import { fmtTime } from "@/lib/types";
import { SEGMENT_TYPES, segmentLabel } from "@/lib/skipLogic";

type Seg = {
  id: string;
  startSec: number;
  endSec: number;
  type: string;
  confidence: number;
  label: string | null;
  trackTitle: string | null;
  trackArtist: string | null;
  trackAlbum: string | null;
  trackYear: number | null;
  manuallyEdited: boolean;
};

type Recording = {
  id: string;
  filename: string;
  displayName: string | null;
  duration: number;
  segments: Seg[];
};

const SEG_COLOR: Record<string, string> = {
  music: "#2c2c2c",
  dj: "#2f6fb0",
  ad: "#c0392b",
  jingle: "#c9a227",
  talkover: "#7d5fb0",
  unknown: "#555555",
};

function regionColor(type: string) {
  return (SEG_COLOR[type] ?? "#444") + "66"; // ~40% alpha
}

export default function EditorPage({
  params,
}: {
  params: Promise<{ recordingId: string }>;
}) {
  const { recordingId } = usePromise(params);
  const [rec, setRec] = useState<Recording | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(2); // pixels per second; ~2 fits an hour

  const waveformRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<unknown>(null);
  const regionsApiRef = useRef<unknown>(null);
  const segmentsRef = useRef<Seg[]>([]);
  segmentsRef.current = rec?.segments ?? [];

  // Load recording + segments.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/recordings/${recordingId}`)
      .then((r) => r.json())
      .then((d: Recording) => {
        if (!cancelled) setRec(d);
      })
      .catch((e) => !cancelled && setError(String(e)));
    return () => {
      cancelled = true;
    };
  }, [recordingId]);

  // Init wavesurfer once we have the element + recording.
  useEffect(() => {
    if (!rec || !waveformRef.current) return;
    let disposed = false;

    type WSCtor = (opts: Record<string, unknown>) => {
      registerPlugin: (p: unknown) => unknown;
      on: (ev: string, cb: (...a: unknown[]) => void) => void;
      destroy: () => void;
      playPause: () => void;
      play: (start?: number, end?: number) => void;
      getCurrentTime: () => number;
      getDuration: () => number;
      zoom: (pxPerSec: number) => void;
      setTime: (sec: number) => void;
    };
    type RegionsApi = {
      addRegion: (opts: Record<string, unknown>) => unknown;
      on: (ev: string, cb: (...a: unknown[]) => void) => void;
      clearRegions: () => void;
      getRegions: () => Array<{
        id: string;
        setOptions?: (o: Record<string, unknown>) => void;
        remove?: () => void;
      }>;
    };

    (async () => {
      const [{ default: WaveSurfer }, RegionsMod] = await Promise.all([
        import("wavesurfer.js"),
        import("wavesurfer.js/dist/plugins/regions.esm.js"),
      ]);
      if (disposed || !waveformRef.current) return;

      const ws = (WaveSurfer as unknown as { create: WSCtor }).create({
        container: waveformRef.current,
        url: `/api/audio/${recordingId}`,
        waveColor: "#2a2a2a",
        progressColor: "#555",
        cursorColor: "#888",
        height: 140,
        barWidth: 2,
        barGap: 1,
        normalize: true,
        minPxPerSec: zoom,
        autoScroll: true,
        autoCenter: true,
        hideScrollbar: false,
      });
      const RegionsPlugin = (RegionsMod as { default: { create: () => unknown } })
        .default;
      const regions = ws.registerPlugin(RegionsPlugin.create()) as RegionsApi;

      wsRef.current = ws;
      regionsApiRef.current = regions;

      // Draw regions once the waveform is decoded so positions align.
      ws.on("decode", () => {
        regions.clearRegions();
        for (const seg of segmentsRef.current) {
          regions.addRegion({
            id: seg.id,
            start: seg.startSec,
            end: seg.endSec,
            color: regionColor(seg.type),
            drag: false,
            resize: true,
            content: segmentLabel(seg.type),
          });
        }
      });

      regions.on("region-clicked", (...args: unknown[]) => {
        const region = args[0] as { id: string };
        setSelectedId(region.id);
      });

      regions.on("region-updated", (...args: unknown[]) => {
        const region = args[0] as { id: string; start: number; end: number };
        void patchSegment(region.id, {
          startSec: region.start,
          endSec: region.end,
        });
      });
    })();

    return () => {
      disposed = true;
      const ws = wsRef.current as { destroy?: () => void } | null;
      ws?.destroy?.();
      wsRef.current = null;
      regionsApiRef.current = null;
    };
  }, [rec?.id]);

  // Re-apply zoom to wavesurfer whenever the slider changes.
  useEffect(() => {
    const ws = wsRef.current as { zoom?: (pxPerSec: number) => void } | null;
    ws?.zoom?.(zoom);
  }, [zoom]);

  // Scroll the waveform view to show the selected segment WITHOUT moving
  // the playhead — so navigating the list doesn't interrupt playback or
  // wipe out the cursor position you carefully aimed for a split.
  useEffect(() => {
    if (!selectedId || !rec || !waveformRef.current) return;
    const seg = rec.segments.find((s) => s.id === selectedId);
    if (!seg) return;
    const ws = wsRef.current as { setScroll?: (px: number) => void } | null;
    if (!ws?.setScroll) return;
    const leftPad = 40; // px of context before the segment start
    const targetPx = Math.max(0, seg.startSec * zoom - leftPad);
    ws.setScroll(targetPx);
  }, [selectedId, rec, zoom]);

  const zoomToSelected = () => {
    if (!selected || !waveformRef.current || !wsRef.current) return;
    const ws = wsRef.current as { setTime: (s: number) => void };
    const dur = selected.endSec - selected.startSec;
    const width = waveformRef.current.clientWidth || 800;
    // fit the selected segment to ~80% of the visible width
    const target = Math.max(2, Math.min(400, (width * 0.8) / dur));
    setZoom(target);
    // re-centre on the segment
    setTimeout(() => ws.setTime((selected.startSec + selected.endSec) / 2), 50);
  };

  const fitWhole = () => {
    if (!rec || !waveformRef.current) return;
    const width = waveformRef.current.clientWidth || 800;
    setZoom(Math.max(0.5, width / rec.duration));
  };

  // Patch helper with optimistic local update + save indicator.
  const patchSegment = async (id: string, patch: Partial<Seg>) => {
    setSaveState("saving");
    setError(null);
    setRec((prev) =>
      prev
        ? {
            ...prev,
            segments: prev.segments.map((s) =>
              s.id === id ? { ...s, ...patch, manuallyEdited: true } : s,
            ),
          }
        : prev,
    );
    try {
      const res = await fetch(`/api/segments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "save failed");
      }
      setSaveState("saved");
      // Update region color if type changed.
      if (patch.type !== undefined) {
        const r = regionsApiRef.current as
          | { getRegions?: () => Array<{ id: string; setOptions?: (o: Record<string, unknown>) => void; element?: HTMLElement }> }
          | null;
        const regions = r?.getRegions?.() ?? [];
        const region = regions.find((rg) => rg.id === id);
        region?.setOptions?.({
          color: regionColor(patch.type),
          content: segmentLabel(patch.type),
        });
      }
      setTimeout(() => setSaveState("idle"), 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "save failed");
      setSaveState("error");
    }
  };

  const selected = useMemo(
    () => rec?.segments.find((s) => s.id === selectedId) ?? null,
    [rec, selectedId],
  );

  const playSelection = () => {
    if (!selected || !wsRef.current) return;
    const ws = wsRef.current as {
      play: (start: number, end?: number) => void;
    };
    ws.play(selected.startSec, selected.endSec);
  };

  const splitAtCursor = async () => {
    if (!wsRef.current || !regionsApiRef.current || !rec) return;
    const ws = wsRef.current as { getCurrentTime: () => number };
    const at = ws.getCurrentTime();
    const seg = rec.segments.find(
      (s) => at > s.startSec && at < s.endSec,
    );
    if (!seg) {
      setError("cursor is not inside any segment");
      setSaveState("error");
      return;
    }
    setSaveState("saving");
    setError(null);
    try {
      const res = await fetch(`/api/segments/${seg.id}/split`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ atSec: at }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "split failed");
      const { left, right } = data as { left: Seg; right: Seg };

      setRec((prev) =>
        prev
          ? {
              ...prev,
              segments: [
                ...prev.segments.map((s) => (s.id === left.id ? left : s)),
                right,
              ].sort((a, b) => a.startSec - b.startSec),
            }
          : prev,
      );

      // Update region on waveform: shrink original, add the new right half.
      const regions = (regionsApiRef.current as {
        getRegions: () => Array<{
          id: string;
          setOptions?: (o: Record<string, unknown>) => void;
        }>;
        addRegion: (opts: Record<string, unknown>) => unknown;
      });
      const orig = regions.getRegions().find((r) => r.id === left.id);
      orig?.setOptions?.({ end: left.endSec });
      regions.addRegion({
        id: right.id,
        start: right.startSec,
        end: right.endSec,
        color: regionColor(right.type),
        drag: false,
        resize: true,
        content: segmentLabel(right.type),
      });

      setSelectedId(right.id);
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "split failed");
      setSaveState("error");
    }
  };

  const trimTail = async () => {
    if (!rec) return;
    const lastEnd = rec.segments.reduce(
      (m, s) => Math.max(m, s.endSec),
      0,
    );
    if (lastEnd <= 0) return;
    const tail = rec.duration - lastEnd;
    if (
      !confirm(
        `Trim ${tail.toFixed(1)}s off the end? Broadcast clock will stop at ${lastEnd.toFixed(1)}s; the mp3 file stays intact.`,
      )
    )
      return;
    setSaveState("saving");
    setError(null);
    try {
      const res = await fetch(`/api/recordings/${rec.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ duration: lastEnd }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "trim failed");
      setRec((prev) => (prev ? { ...prev, duration: lastEnd } : prev));
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "trim failed");
      setSaveState("error");
    }
  };

  const deleteSegment = async (id: string) => {
    if (!confirm("Delete this segment? The audio range becomes unlabeled."))
      return;
    setSaveState("saving");
    setError(null);
    try {
      const res = await fetch(`/api/segments/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "delete failed");
      }
      setRec((prev) =>
        prev
          ? { ...prev, segments: prev.segments.filter((s) => s.id !== id) }
          : prev,
      );
      const regions = regionsApiRef.current as {
        getRegions: () => Array<{ id: string; remove?: () => void }>;
      } | null;
      regions?.getRegions().find((r) => r.id === id)?.remove?.();
      if (selectedId === id) setSelectedId(null);
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "delete failed");
      setSaveState("error");
    }
  };

  return (
    <div className="min-h-screen bg-[#080808] text-white">
      <header className="px-8 py-4 border-b border-[#141414] flex items-center gap-4">
        <Link
          href="/library"
          className="text-xs font-semibold tracking-[0.15em] text-[#666] hover:text-white"
        >
          ← LIBRARY
        </Link>
        <span className="text-xs font-semibold tracking-[0.15em] text-[#888]">
          EDITOR
        </span>
        {rec && (
          <span className="text-[12px] text-[#666] truncate">
            {rec.displayName ?? rec.filename}
          </span>
        )}
        <span className="ml-auto text-[11px]">
          {saveState === "saving" && <span className="text-[#888]">saving…</span>}
          {saveState === "saved" && <span className="text-[#3a7d44]">saved</span>}
          {saveState === "error" && (
            <span className="text-[#c0392b]">save failed</span>
          )}
        </span>
      </header>

      <main className="px-8 py-7">
        {error && saveState === "error" && (
          <p className="text-[12px] text-[#c0392b] mb-3">{error}</p>
        )}

        <div
          ref={waveformRef}
          className="rounded-lg border border-[#181818] bg-[#0d0d0d] overflow-hidden"
        />

        <div className="flex items-center gap-3 mt-3 text-[11px] text-[#555]">
          <button
            onClick={() => {
              const ws = wsRef.current as { playPause?: () => void } | null;
              ws?.playPause?.();
            }}
            className="px-3 py-1.5 rounded border border-[#222] text-[#999] hover:text-white"
          >
            Play / Pause
          </button>
          <button
            disabled={!selected}
            onClick={playSelection}
            className="px-3 py-1.5 rounded border border-[#222] text-[#999] hover:text-white disabled:opacity-30"
          >
            Play selected
          </button>
          <button
            onClick={splitAtCursor}
            className="px-3 py-1.5 rounded border border-[#2f6fb0] text-[#2f6fb0] hover:bg-[#10141a]"
            title="Split the segment under the playhead in two"
          >
            ✂ Split at cursor
          </button>

          <div className="flex items-center gap-2 ml-3 pl-3 border-l border-[#1f1f1f]">
            <button
              onClick={() => setZoom((z) => Math.max(0.5, z / 1.6))}
              className="w-7 h-7 rounded border border-[#222] text-[#888] hover:text-white"
              title="Zoom out"
            >
              −
            </button>
            <input
              type="range"
              min={0.5}
              max={400}
              step={0.5}
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="w-40 accent-[#666]"
              title={`${zoom.toFixed(1)} px/sec`}
            />
            <button
              onClick={() => setZoom((z) => Math.min(400, z * 1.6))}
              className="w-7 h-7 rounded border border-[#222] text-[#888] hover:text-white"
              title="Zoom in"
            >
              +
            </button>
            <button
              onClick={fitWhole}
              className="px-2 h-7 rounded border border-[#222] text-[#888] hover:text-white"
              title="Fit whole recording"
            >
              Fit
            </button>
            <button
              onClick={zoomToSelected}
              disabled={!selected}
              className="px-2 h-7 rounded border border-[#222] text-[#888] hover:text-white disabled:opacity-30"
              title="Zoom to selected segment"
            >
              Zoom ↳ sel
            </button>
          </div>

          {rec && (() => {
            const lastEnd = rec.segments.reduce(
              (m, s) => Math.max(m, s.endSec),
              0,
            );
            const tail = rec.duration - lastEnd;
            return tail > 2 ? (
              <button
                onClick={trimTail}
                className="ml-3 px-2 h-7 rounded border border-[#5a2a2a] text-[#c0392b] hover:bg-[#1a0d0d]"
                title={`Cut the unsegmented ${tail.toFixed(1)}s tail`}
              >
                ✂ Trim tail ({tail.toFixed(1)}s)
              </button>
            ) : null;
          })()}

          <span className="ml-auto">
            {rec?.segments.length ?? 0} segments ·{" "}
            {rec?.segments.filter((s) => s.manuallyEdited).length ?? 0} edited
          </span>
        </div>

        <div className="mt-8 grid grid-cols-[1fr_320px] gap-8">
          {/* segment list */}
          <SegmentList
            segments={rec?.segments ?? []}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />

          {/* inspector */}
          {selected ? (
            <Inspector
              key={selected.id}
              seg={selected}
              onChange={(patch) => patchSegment(selected.id, patch)}
              onPlay={playSelection}
              onDelete={() => deleteSegment(selected.id)}
            />
          ) : (
            <aside className="text-[12px] text-[#3a3a3a] border border-dashed border-[#1f1f1f] rounded-lg p-5">
              Click a segment in the waveform or list to edit it.
            </aside>
          )}
        </div>
      </main>
    </div>
  );
}

function SegmentList({
  segments,
  selectedId,
  onSelect,
}: {
  segments: Seg[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (segments.length === 0) {
    return (
      <div className="text-[12px] text-[#3a3a3a]">
        No segments. Process this recording in Library first.
      </div>
    );
  }
  return (
    <ul className="flex flex-col gap-1">
      {segments.map((s) => {
        const active = s.id === selectedId;
        const hasTrack = s.type === "music" || s.type === "talkover";
        const name =
          hasTrack && s.trackTitle
            ? `${s.trackTitle}${s.trackArtist ? " — " + s.trackArtist : ""}`
            : s.label?.trim() || segmentLabel(s.type);
        return (
          <li key={s.id}>
            <button
              onClick={() => onSelect(s.id)}
              className="w-full text-left flex items-center gap-3 px-3 py-2 rounded border transition-colors"
              style={{
                background: active ? "#121212" : "#0d0d0d",
                borderColor: active ? "#2a2a2a" : "#161616",
              }}
            >
              <span
                className="w-2 h-8 rounded-sm"
                style={{ background: SEG_COLOR[s.type] ?? "#444" }}
              />
              <span className="text-[10px] text-[#3a3a3a] w-24">
                {fmtTime(s.startSec)}–{fmtTime(s.endSec)}
              </span>
              <span
                className="text-[12px] flex-1 truncate"
                style={{ color: active ? "#fff" : "#888" }}
              >
                {name}
              </span>
              {s.manuallyEdited && (
                <span className="text-[9px] text-[#3a7d44]">●</span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function Inspector({
  seg,
  onChange,
  onPlay,
  onDelete,
}: {
  seg: Seg;
  onChange: (patch: Partial<Seg>) => void;
  onPlay: () => void;
  onDelete: () => void;
}) {
  const [label, setLabel] = useState(seg.label ?? "");
  const [title, setTitle] = useState(seg.trackTitle ?? "");
  const [artist, setArtist] = useState(seg.trackArtist ?? "");
  const [album, setAlbum] = useState(seg.trackAlbum ?? "");
  const [year, setYear] = useState<string>(
    seg.trackYear ? String(seg.trackYear) : "",
  );

  const commit = (patch: Partial<Seg>) => onChange(patch);

  return (
    <aside className="border border-[#181818] rounded-lg p-5 bg-[#0d0d0d]">
      <p className="text-[10px] text-[#3a3a3a] tracking-[0.1em] uppercase mb-3">
        Segment
      </p>
      <p className="text-[12px] text-[#555] mb-4">
        {fmtTime(seg.startSec)} — {fmtTime(seg.endSec)} ·{" "}
        {fmtTime(seg.endSec - seg.startSec)}
      </p>

      <label className="block text-[10px] text-[#555] uppercase tracking-[0.08em] mb-1.5">
        Type
      </label>
      <div className="flex flex-wrap gap-1.5 mb-5">
        {SEGMENT_TYPES.map((t) => {
          const on = seg.type === t;
          return (
            <button
              key={t}
              onClick={() => commit({ type: t })}
              className="text-[11px] px-2.5 py-1 rounded border transition-colors"
              style={{
                background: on ? (SEG_COLOR[t] ?? "#333") + "33" : "#0d0d0d",
                borderColor: on ? SEG_COLOR[t] ?? "#444" : "#1f1f1f",
                color: on ? "#fff" : "#777",
              }}
            >
              {segmentLabel(t)}
            </button>
          );
        })}
      </div>

      <label className="block text-[10px] text-[#555] uppercase tracking-[0.08em] mb-1.5">
        Note
      </label>
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onBlur={() => {
          if ((seg.label ?? "") !== label) commit({ label: label || null });
        }}
        placeholder="freeform label / note"
        className="w-full bg-[#0d0d0d] border border-[#1f1f1f] rounded px-2.5 py-1.5 text-[12px] mb-5"
      />

      {(seg.type === "music" || seg.type === "talkover") && (
        <div className="space-y-3 mb-5">
          <p className="text-[10px] text-[#555] uppercase tracking-[0.08em]">
            {seg.type === "talkover" ? "Track (under the comment)" : "Track"}
          </p>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => {
              if ((seg.trackTitle ?? "") !== title)
                commit({ trackTitle: title || null });
            }}
            placeholder="Title"
            className="w-full bg-[#0d0d0d] border border-[#1f1f1f] rounded px-2.5 py-1.5 text-[12px]"
          />
          <input
            value={artist}
            onChange={(e) => setArtist(e.target.value)}
            onBlur={() => {
              if ((seg.trackArtist ?? "") !== artist)
                commit({ trackArtist: artist || null });
            }}
            placeholder="Artist"
            className="w-full bg-[#0d0d0d] border border-[#1f1f1f] rounded px-2.5 py-1.5 text-[12px]"
          />
          <input
            value={album}
            onChange={(e) => setAlbum(e.target.value)}
            onBlur={() => {
              if ((seg.trackAlbum ?? "") !== album)
                commit({ trackAlbum: album || null });
            }}
            placeholder="Album"
            className="w-full bg-[#0d0d0d] border border-[#1f1f1f] rounded px-2.5 py-1.5 text-[12px]"
          />
          <input
            value={year}
            onChange={(e) =>
              setYear(e.target.value.replace(/[^\d]/g, "").slice(0, 4))
            }
            onBlur={() => {
              const n = year ? parseInt(year, 10) : null;
              if ((seg.trackYear ?? null) !== n) commit({ trackYear: n });
            }}
            placeholder="Year"
            className="w-32 bg-[#0d0d0d] border border-[#1f1f1f] rounded px-2.5 py-1.5 text-[12px]"
          />
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={onPlay}
          className="flex-1 text-[11px] px-3 py-2 rounded border border-[#222] text-[#999] hover:text-white"
        >
          Play
        </button>
        <button
          onClick={onDelete}
          className="text-[11px] px-3 py-2 rounded border border-[#3a1a1a] text-[#7d3a3a] hover:bg-[#1a0d0d] hover:text-[#c0392b]"
        >
          Delete
        </button>
      </div>
    </aside>
  );
}
