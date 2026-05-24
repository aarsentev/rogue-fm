"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { fmtTime } from "@/lib/types";

type Rec = {
  id: string;
  filename: string;
  displayName: string | null;
  duration: number;
  fileSize: number;
  uploadedAt: string;
  processedAt: string | null;
  processingStatus: string;
  segmentCount: number;
  processing: boolean;
};

type Stn = {
  id: string;
  name: string;
  freq: string;
  genre?: string;
  color: string;
  logoPath?: string | null;
  recordings: Rec[];
};

type Form = { name: string; freq: string; genre: string; color: string };

const EMPTY: Form = { name: "", freq: "", genre: "", color: "#d4a017" };

const STATUS_COLOR: Record<string, string> = {
  pending: "#7d6f3a",
  processing: "#3a6f7d",
  done: "#3a7d44",
  failed: "#c0392b",
};

function StatusBadge({ status, processing }: { status: string; processing: boolean }) {
  const s = processing ? "processing" : status;
  return (
    <span
      className="text-[10px] tracking-[0.08em] uppercase px-2 py-[3px] rounded"
      style={{ background: (STATUS_COLOR[s] ?? "#333") + "33", color: STATUS_COLOR[s] ?? "#888" }}
    >
      {s}
    </span>
  );
}

function LogoCell({
  station,
  onUpload,
  onClear,
}: {
  station: Stn;
  onUpload: (f: File) => void;
  onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={() => inputRef.current?.click()}
        title="Upload logo"
        className="w-7 h-7 rounded-md overflow-hidden border border-[#222] cursor-pointer flex items-center justify-center"
        style={{ background: station.color }}
      >
        {station.logoPath ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/logo/${station.id}?t=${station.logoPath}`}
            alt=""
            width={28}
            height={28}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-[8px] text-white/70">{station.freq}</span>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onUpload(f);
          e.target.value = "";
        }}
      />
      {station.logoPath && (
        <button
          onClick={onClear}
          title="Remove logo"
          className="text-[10px] text-[#3a3a3a] hover:text-[#c0392b]"
        >
          ×
        </button>
      )}
    </div>
  );
}

function StationForm({
  value,
  onChange,
  onSubmit,
  onCancel,
  submitLabel,
}: {
  value: Form;
  onChange: (f: Form) => void;
  onSubmit: () => void;
  onCancel: () => void;
  submitLabel: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 p-3 rounded-lg bg-[#0f0f0f] border border-[#222] mb-3">
      <input
        placeholder="Name"
        value={value.name}
        onChange={(e) => onChange({ ...value, name: e.target.value })}
        className="bg-[#0d0d0d] border border-[#222] rounded px-2.5 py-1.5 text-[12px] w-40"
      />
      <input
        placeholder="Freq (98.3)"
        value={value.freq}
        onChange={(e) => onChange({ ...value, freq: e.target.value })}
        className="bg-[#0d0d0d] border border-[#222] rounded px-2.5 py-1.5 text-[12px] w-24"
      />
      <input
        placeholder="Genre"
        value={value.genre}
        onChange={(e) => onChange({ ...value, genre: e.target.value })}
        className="bg-[#0d0d0d] border border-[#222] rounded px-2.5 py-1.5 text-[12px] w-44"
      />
      <input
        type="color"
        value={value.color}
        onChange={(e) => onChange({ ...value, color: e.target.value })}
        className="w-9 h-8 bg-transparent border border-[#222] rounded cursor-pointer"
      />
      <button
        onClick={onSubmit}
        className="text-[11px] px-3 py-1.5 rounded border border-[#2f6f3a] text-[#3a7d44] hover:bg-[#0d130d]"
      >
        {submitLabel}
      </button>
      <button
        onClick={onCancel}
        className="text-[11px] px-3 py-1.5 rounded border border-[#222] text-[#666] hover:text-white"
      >
        Cancel
      </button>
    </div>
  );
}

export default function Library() {
  const [stations, setStations] = useState<Stn[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState<Form>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Form>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/recordings");
      const d = await r.json();
      setStations(d.stations);
      return d.stations as Stn[];
    } catch (e) {
      console.error("library load failed", e);
      return null;
    }
  }, []);

  const schedulePoll = useCallback(() => {
    if (pollRef.current) clearTimeout(pollRef.current);
    const tick = async () => {
      const s = await load();
      if (!s) return;
      const anyProcessing = s.some((st) =>
        st.recordings.some(
          (r) => r.processing || r.processingStatus === "processing",
        ),
      );
      if (anyProcessing) pollRef.current = setTimeout(tick, 4000);
    };
    pollRef.current = setTimeout(tick, 2000);
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const s = await load();
      if (cancelled || !s) return;
      const anyProcessing = s.some((st) =>
        st.recordings.some(
          (r) => r.processing || r.processingStatus === "processing",
        ),
      );
      if (anyProcessing) schedulePoll();
    })();
    return () => {
      cancelled = true;
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, [load, schedulePoll]);

  const process = async (id: string) => {
    await fetch(`/api/recordings/${id}/process`, { method: "POST" });
    setStations((prev) =>
      prev
        ? prev.map((st) => ({
            ...st,
            recordings: st.recordings.map((r) =>
              r.id === id ? { ...r, processing: true } : r,
            ),
          }))
        : prev,
    );
    schedulePoll();
  };

  const createStation = async () => {
    setError(null);
    const res = await fetch("/api/stations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createForm),
    });
    const d = await res.json();
    if (!res.ok) {
      setError(d.error ?? "create failed");
      return;
    }
    setCreating(false);
    setCreateForm(EMPTY);
    load();
  };

  const saveEdit = async (id: string) => {
    setError(null);
    const res = await fetch(`/api/stations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    });
    const d = await res.json();
    if (!res.ok) {
      setError(d.error ?? "update failed");
      return;
    }
    setEditingId(null);
    load();
  };

  const uploadLogo = async (id: string, file: File) => {
    setError(null);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`/api/stations/${id}/logo`, {
      method: "POST",
      body: fd,
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "logo upload failed");
      return;
    }
    load();
  };

  const clearLogo = async (id: string) => {
    setError(null);
    const res = await fetch(`/api/stations/${id}/logo`, { method: "DELETE" });
    if (!res.ok) {
      setError("failed to clear logo");
      return;
    }
    load();
  };

  const deleteStation = async (st: Stn) => {
    const n = st.recordings.length;
    if (
      !confirm(
        `Delete "${st.name}"? This removes ${n} recording(s), their segments, and the mp3 files. Irreversible.`,
      )
    )
      return;
    setError(null);
    const res = await fetch(`/api/stations/${st.id}`, { method: "DELETE" });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "delete failed");
      return;
    }
    load();
  };

  return (
    <div className="min-h-screen bg-[#080808] text-white">
      <header className="px-8 py-4 border-b border-[#141414] flex items-center gap-4">
        <Link
          href="/"
          className="text-xs font-semibold tracking-[0.15em] text-[#666] hover:text-white"
        >
          ← ROGUE FM
        </Link>
        <span className="text-xs font-semibold tracking-[0.15em] text-[#888]">
          LIBRARY
        </span>
        <button
          onClick={() => {
            setCreating((v) => !v);
            setCreateForm(EMPTY);
          }}
          className="ml-auto text-[11px] text-[#666] hover:text-white border border-[#222] rounded px-3 py-1"
        >
          + New station
        </button>
        <Link
          href="/upload"
          className="text-[11px] text-[#666] hover:text-white border border-[#222] rounded px-3 py-1"
        >
          + Upload
        </Link>
      </header>

      <main className="px-10 py-9 max-w-[900px]">
        {error && (
          <p className="text-[12px] text-[#c0392b] mb-4">{error}</p>
        )}

        {creating && (
          <StationForm
            value={createForm}
            onChange={setCreateForm}
            onSubmit={createStation}
            onCancel={() => setCreating(false)}
            submitLabel="Create"
          />
        )}

        {!stations ? (
          <p className="text-[#666]">Loading…</p>
        ) : (
          stations.map((st) => (
            <section key={st.id} className="mb-9">
              {editingId === st.id ? (
                <StationForm
                  value={editForm}
                  onChange={setEditForm}
                  onSubmit={() => saveEdit(st.id)}
                  onCancel={() => setEditingId(null)}
                  submitLabel="Save"
                />
              ) : (
                <div className="flex items-center gap-3 mb-3">
                  <LogoCell
                    station={st}
                    onUpload={(f) => uploadLogo(st.id, f)}
                    onClear={() => clearLogo(st.id)}
                  />
                  <h2 className="text-[15px] font-semibold">{st.name}</h2>
                  <span className="text-[11px] text-[#444]">
                    {st.freq} FM{st.genre ? ` · ${st.genre}` : ""}
                  </span>
                  <button
                    onClick={() => {
                      setEditingId(st.id);
                      setEditForm({
                        name: st.name,
                        freq: st.freq,
                        genre: st.genre ?? "",
                        color: st.color,
                      });
                    }}
                    className="ml-3 text-[11px] text-[#555] hover:text-white"
                  >
                    edit
                  </button>
                  <button
                    onClick={() => deleteStation(st)}
                    className="text-[11px] text-[#5a2a2a] hover:text-[#c0392b]"
                  >
                    delete
                  </button>
                </div>
              )}

              {st.recordings.length === 0 ? (
                <p className="text-[12px] text-[#3a3a3a] pl-5">
                  No recordings.
                </p>
              ) : (
                <div className="flex flex-col gap-1">
                  {st.recordings.map((r) => {
                    const busy =
                      r.processing || r.processingStatus === "processing";
                    return (
                      <div
                        key={r.id}
                        className="flex items-center gap-4 px-4 py-3 rounded-lg bg-[#0f0f0f] border border-[#181818]"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] text-white truncate">
                            {r.displayName ?? r.filename}
                          </p>
                          <p className="text-[11px] text-[#555]">
                            {r.duration > 0 ? fmtTime(r.duration) : "—"} ·{" "}
                            {(r.fileSize / 1_000_000).toFixed(1)} MB ·{" "}
                            {r.segmentCount} segments
                          </p>
                        </div>
                        <StatusBadge
                          status={r.processingStatus}
                          processing={r.processing}
                        />
                        {r.processingStatus === "done" && (
                          <Link
                            href={`/editor/${r.id}`}
                            className="text-[11px] px-3 py-1.5 rounded border border-[#222] text-[#999] hover:text-white hover:border-[#333]"
                          >
                            Edit
                          </Link>
                        )}
                        <button
                          disabled={busy}
                          onClick={() => process(r.id)}
                          className="text-[11px] px-3 py-1.5 rounded border border-[#222] text-[#999] hover:text-white hover:border-[#333] disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {busy
                            ? "Processing…"
                            : r.processingStatus === "done"
                              ? "Reprocess"
                              : "Process"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          ))
        )}
      </main>
    </div>
  );
}
