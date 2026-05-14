"use client";

import { Howl } from "howler";

const SYNC_THRESHOLD_SEC = 1.5;

export class Player {
  private howl: Howl | null = null;
  private currentRecordingId: string | null = null;
  private muted = false;

  loadAndSync(recordingId: string, offsetSec: number) {
    if (this.currentRecordingId !== recordingId) {
      this.howl?.unload();
      this.howl = new Howl({
        src: [`/api/audio/${recordingId}`],
        format: ["mp3"],
        html5: true,
        autoplay: true,
        mute: this.muted,
        onloaderror: (_id, err) => console.error("howl load error", err),
        onplayerror: (_id, err) => console.error("howl play error", err),
      });
      this.currentRecordingId = recordingId;
      this.howl.once("play", () => {
        this.howl?.seek(offsetSec);
      });
      return;
    }
    this.resync(offsetSec);
  }

  resync(offsetSec: number) {
    if (!this.howl) return;
    const pos = this.howl.seek();
    const current = typeof pos === "number" ? pos : 0;
    if (Math.abs(current - offsetSec) > SYNC_THRESHOLD_SEC) {
      this.howl.seek(offsetSec);
    }
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
