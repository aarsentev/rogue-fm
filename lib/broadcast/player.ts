"use client";

import { Howl } from "howler";
import { playRadioStatic } from "./static";
import { getSettings } from "./settings";

const FADE_MS = 500;
const STATIC_MS = 700;
const SYNC_THRESHOLD_SEC = 1.5;

export class Player {
  private howl: Howl | null = null;
  private currentRecordingId: string | null = null;
  private muted = false;
  private onEndedCb: (() => void) | null = null;
  private ended = false;

  setOnEnded(cb: (() => void) | null) {
    this.onEndedCb = cb;
  }

  // `duration` is the recording's LOGICAL (trimmed) length from the DB, which
  // can be shorter than the physical audio file — the tail past it is trimmed
  // garbage. The broadcast clock wraps at the logical length, so we must stop
  // the audio there rather than at the file's physical end.
  loadAndSync(recordingId: string, offsetSec: number, duration: number) {
    if (recordingId !== this.currentRecordingId) {
      this.transitionTo(recordingId, offsetSec);
    } else if (this.ended) {
      this.replay(offsetSec);
    } else if (this.isPastLogicalEnd(offsetSec, duration)) {
      // Same recording looping onto itself: the clock has wrapped back near
      // the start while the file is still playing its trimmed tail. Jump to
      // the new offset instead of letting that garbage play out.
      this.replay(offsetSec);
    } else {
      this.resync(offsetSec);
    }
  }

  // True when playback has reached the logical end but the clock has already
  // wrapped to an earlier offset (the tell-tale of a same-recording loop).
  private isPastLogicalEnd(offsetSec: number, duration: number): boolean {
    if (duration <= 0) return false;
    const cur = this.getPositionSec();
    if (cur == null) return false;
    return cur >= duration && cur - offsetSec > 1;
  }

  private replay(offsetSec: number) {
    if (!this.howl) return;
    this.ended = false;
    this.howl.seek(offsetSec);
    this.howl.play();
  }

  private transitionTo(recordingId: string, offsetSec: number) {
    // Tuning static is a classic-mode flourish; skip it in modern mode.
    if (!this.muted && getSettings().classicMode) {
      playRadioStatic(STATIC_MS, 0.35);
    }

    const oldHowl = this.howl;
    this.ended = false;

    const h = new Howl({
      src: [`/api/audio/${recordingId}`],
      format: ["mp3"],
      html5: true,
      autoplay: true,
      mute: this.muted,
      volume: 0,
      onloaderror: (_id, err) => console.error("howl load error", err),
      onplayerror: (_id, err) => console.error("howl play error", err),
      onend: () => {
        this.ended = true;
        this.onEndedCb?.();
      },
    });

    h.once("play", () => {
      h.seek(offsetSec);
      h.fade(0, 1, FADE_MS);
    });

    this.howl = h;
    this.currentRecordingId = recordingId;

    if (oldHowl) {
      try {
        const v = oldHowl.volume();
        const startVolume = typeof v === "number" ? v : 1;
        oldHowl.fade(startVolume, 0, FADE_MS);
      } catch {
        // ignore
      }
      setTimeout(() => {
        try {
          oldHowl.unload();
        } catch {
          // ignore
        }
      }, FADE_MS + 100);
    }
  }

  resync(offsetSec: number) {
    if (!this.howl) return;
    const pos = this.howl.seek();
    const current = typeof pos === "number" ? pos : 0;
    // One-directional: only correct when we've fallen BEHIND the broadcast
    // clock (buffering / backgrounded tab throttling). Never pull back —
    // that would instantly undo a skip / fast-forward.
    if (offsetSec - current > SYNC_THRESHOLD_SEC) {
      this.howl.seek(offsetSec);
    }
  }

  getPositionSec(): number | null {
    if (!this.howl) return null;
    const p = this.howl.seek();
    return typeof p === "number" ? p : null;
  }

  seekTo(sec: number) {
    this.howl?.seek(sec);
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    this.howl?.mute(muted);
  }

  isMuted() {
    return this.muted;
  }

  unload() {
    this.howl?.unload();
    this.howl = null;
    this.currentRecordingId = null;
    this.ended = false;
  }
}

let singleton: Player | null = null;
export function getPlayer(): Player {
  if (!singleton) singleton = new Player();
  return singleton;
}
