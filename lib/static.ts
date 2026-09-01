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

export function playRadioClick(peakGain = 0.9): void {
  const ctx = getCtx();
  if (!ctx) return;
  try {
    const t0 = ctx.currentTime + 0.001;

    const master = ctx.createGain();
    master.gain.value = peakGain;
    master.connect(ctx.destination);

    // A short noise burst, high-passed into a percussive "tick".
    const tick = (start: number, durMs: number, hpHz: number, gain: number) => {
      const samples = Math.max(1, Math.floor((ctx.sampleRate * durMs) / 1000));
      const buf = ctx.createBuffer(1, samples, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < samples; i++) {
        const env = Math.pow(1 - i / samples, 2);
        d[i] = (Math.random() * 2 - 1) * env;
      }
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = hpHz;
      const g = ctx.createGain();
      g.gain.value = gain;
      src.connect(hp).connect(g).connect(master);
      src.start(start);
      src.stop(start + durMs / 1000);
    };

    // Low sine with a downward pitch sweep and fast decay — the "thunk" body.
    const thunk = (
      start: number,
      freq: number,
      durMs: number,
      gain: number,
    ) => {
      const dur = durMs / 1000;
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, start);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.55, start + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, start);
      g.gain.linearRampToValueAtTime(gain, start + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
      osc.connect(g).connect(master);
      osc.start(start);
      osc.stop(start + dur + 0.02);
    };

    tick(t0, 9, 1800, 0.85); // contact tick
    thunk(t0, 165, 120, 0.9); // body thunk
    tick(t0 + 0.045, 6, 1400, 0.4); // latch/return tick
  } catch (e) {
    console.warn("click playback failed", e);
  }
}
