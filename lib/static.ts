"use client";

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    try {
      audioCtx = new AudioContext();
    } catch {
      return null;
    }
  }
  if (audioCtx.state === "suspended") {
    void audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/**
 * Brief band-passed white noise burst — radio tuning static.
 * Played as an overlay during station/recording transitions.
 */
export function playRadioStatic(durationMs = 350, peakGain = 0.35): void {
  const ctx = getCtx();
  if (!ctx) return;
  try {
    const samples = Math.floor((ctx.sampleRate * durationMs) / 1000);
    const buffer = ctx.createBuffer(1, samples, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < samples; i++) data[i] = Math.random() * 2 - 1;

    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 1500;
    filter.Q.value = 0.6;

    const gain = ctx.createGain();
    const t0 = ctx.currentTime;
    const dur = durationMs / 1000;
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(peakGain, t0 + 0.03);
    gain.gain.linearRampToValueAtTime(peakGain * 0.5, t0 + dur * 0.5);
    gain.gain.linearRampToValueAtTime(0, t0 + dur);

    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start();
    src.stop(t0 + dur);
  } catch (e) {
    console.warn("static playback failed", e);
  }
}
