// Client for the track-identification endpoints. Kept separate from the
// component so the fetch shapes and result types live in one place.

export type Match = {
  title: string;
  artist: string | null;
  album: string | null;
  score: number | null;
};

export type Outcome =
  | { kind: "matched"; match: Match }
  | { kind: "acoustic"; score: number }
  | { kind: "nomatch" }
  | { kind: "error"; message: string };

/** Fingerprint + look up the segment's track. Never throws for a no-match. */
export async function identify(segmentId: string): Promise<Outcome> {
  const res = await fetch(`/api/segments/${segmentId}/identify`, {
    method: "POST",
  });
  if (!res.ok) {
    let message = "Identification unavailable";
    try {
      const j = await res.json();
      if (j?.error) message = j.error;
    } catch {
      // keep the default message
    }
    return { kind: "error", message };
  }
  const j = await res.json();
  if (j.matched && j.title) {
    return {
      kind: "matched",
      match: {
        title: j.title,
        artist: j.artist ?? null,
        album: j.album ?? null,
        score: j.score ?? null,
      },
    };
  }
  if (j.acousticScore) return { kind: "acoustic", score: j.acousticScore };
  return { kind: "nomatch" };
}

/** Persist a confirmed match onto the segment (marks it manually edited). */
export async function saveTrack(segmentId: string, m: Match): Promise<void> {
  const res = await fetch(`/api/segments/${segmentId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      trackTitle: m.title,
      trackArtist: m.artist,
      trackAlbum: m.album,
    }),
  });
  if (!res.ok) throw new Error("save failed");
}
