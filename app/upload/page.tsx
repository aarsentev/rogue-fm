"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Stn = { id: string; name: string; freq: string };

export default function Upload() {
  const router = useRouter();
  const [stations, setStations] = useState<Stn[]>([]);
  const [stationId, setStationId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/stations")
      .then((r) => r.json())
      .then((d: { stations: Stn[] }) => {
        setStations(d.stations);
        if (d.stations[0]) setStationId(d.stations[0].id);
      })
      .catch(() => setError("failed to load stations"));
  }, []);

  const pick = (f: File | null) => {
    setError(null);
    if (f && !/\.mp3$/i.test(f.name)) {
      setError("only .mp3 files are accepted");
      return;
    }
    setFile(f);
    if (f && !displayName) {
      setDisplayName(f.name.replace(/\.[^.]+$/, ""));
    }
  };

  const submit = async () => {
    if (!file || !stationId) return;
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("stationId", stationId);
      fd.append("displayName", displayName);

      const up = await fetch("/api/recordings/upload", {
        method: "POST",
        body: fd,
      });
      const data = await up.json();
      if (!up.ok) throw new Error(data.error ?? "upload failed");

      // kick off processing immediately; Library shows progress
      await fetch(`/api/recordings/${data.id}/process`, { method: "POST" });
      router.push("/library");
    } catch (e) {
      setError(e instanceof Error ? e.message : "upload failed");
      setBusy(false);
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
          UPLOAD
        </span>
      </header>

      <main className="px-10 py-9 max-w-[560px]">
        <label className="block text-[11px] text-[#555] uppercase tracking-[0.1em] mb-2">
          Station
        </label>
        <select
          value={stationId}
          onChange={(e) => setStationId(e.target.value)}
          className="w-full mb-6 bg-[#0f0f0f] border border-[#222] rounded-lg px-3 py-2.5 text-[13px] text-white"
        >
          {stations.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} · {s.freq} FM
            </option>
          ))}
        </select>

        <label className="block text-[11px] text-[#555] uppercase tracking-[0.1em] mb-2">
          Recording (.mp3)
        </label>
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            pick(e.dataTransfer.files?.[0] ?? null);
          }}
          className="mb-6 rounded-lg border border-dashed px-6 py-10 text-center cursor-pointer transition-colors"
          style={{
            borderColor: dragOver ? "#7d5fb0" : "#262626",
            background: dragOver ? "#13101a" : "#0d0d0d",
          }}
        >
          <input
            ref={inputRef}
            type="file"
            accept="audio/mpeg,.mp3"
            className="hidden"
            onChange={(e) => pick(e.target.files?.[0] ?? null)}
          />
          {file ? (
            <p className="text-[13px] text-white">
              {file.name}{" "}
              <span className="text-[#555]">
                ({(file.size / 1_000_000).toFixed(1)} MB)
              </span>
            </p>
          ) : (
            <p className="text-[13px] text-[#555]">
              Drop an .mp3 here or click to choose
            </p>
          )}
        </div>

        <label className="block text-[11px] text-[#555] uppercase tracking-[0.1em] mb-2">
          Display name
        </label>
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="e.g. Radio X — Vol. 2"
          className="w-full mb-6 bg-[#0f0f0f] border border-[#222] rounded-lg px-3 py-2.5 text-[13px] text-white"
        />

        {error && (
          <p className="text-[12px] text-[#c0392b] mb-4">{error}</p>
        )}

        <button
          disabled={!file || !stationId || busy}
          onClick={submit}
          className="px-5 py-2.5 rounded-lg border border-[#262626] bg-[#0f0f0f] hover:bg-[#141414] text-[13px] text-[#ccc] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {busy ? "Uploading…" : "Upload & process"}
        </button>
      </main>
    </div>
  );
}
