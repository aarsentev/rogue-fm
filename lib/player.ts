"use client";

import { Howl } from "howler";
import { playRadioStatic } from "./static";

const FADE_MS = 500;
const STATIC_MS = 700;
const SYNC_THRESHOLD_SEC = 1.5;

export class Player {
  private howl: Howl | null = null;
  private currentRecordingId: string | null = null;
  private muted = false;
  private onEndedCb: (() => void) | null = null;

  setOnEnded(cb: (() => void) | null) {
    this.onEndedCb = cb;
  }

  loadAndSync(recordingId: string, offsetSec: number) {
    if (recordingId !== this.currentRecordingId) {
      this.transitionTo(recordingId, offsetSec);
    } else {
      this.resync(offsetSec);
    }
  }

  private transitionTo(recordingId: string, offsetSec: number) {
    if (!this.muted) playRadioStatic(STATIC_MS, 0.35);

    const oldHowl = this.howl;

    const h = new Howl({
      src: [`/api/audio/${recordingId}`],
      format: ["mp3"],
      html5: true,
      autoplay: true,
      mute: this.muted,
      volume: 0,
      onloaderror: (_id, err) => console.error("howl load error", err),
      onplayerror: (_id, err) => console.error("howl play error", err),
      onend: () => this.onEndedCb?.(),
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
  }
}

let singleton: Player | null = null;
export function getPlayer(): Player {
  if (!singleton) singleton = new Player();
  return singleton;
}
