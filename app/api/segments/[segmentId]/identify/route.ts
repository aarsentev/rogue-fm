import path from "node:path";
import { prisma } from "@/lib/db";
import { identifySegment, type IdentifyResult } from "@/lib/ml/identify";
import { songSpan } from "@/lib/ml/songSpan";

export const dynamic = "force-dynamic";

const ROOT = process.cwd();

// Try each window in order; return the first real match, else the best
// non-match (acoustic over a plain miss). A key/config error stops early.
async function identifyWindows(
  filePath: string,
  segmentId: string,
  windows: { startSec: number; endSec: number }[],
): Promise<IdentifyResult> {
  let best: IdentifyResult | null = null;
  for (const w of windows) {
    const r = await identifySegment({
      filePath,
      startSec: w.startSec,
      endSec: w.endSec,
      segmentId,
    });
    if (r.error) return r;
    if (r.matched) return r;
    if (!best || (r.acousticScore && !best.acousticScore)) best = r;
  }
  return best ?? { matched: false };
}

/**
 * Identify the track under a segment via acoustic fingerprinting (AcoustID).
 * NOTE: deliberately does NOT persist the result yet — it returns the match to
 * the client transiently. Saving onto the Segment comes later.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ segmentId: string }> },
) {
  const { segmentId } = await params;

  const seg = await prisma.segment.findUnique({
    where: { id: segmentId },
    select: {
      id: true,
      startSec: true,
      endSec: true,
      recordingId: true,
      recording: { select: { filename: true } },
    },
  });
  if (!seg) {
    return Response.json({ error: "Segment not found" }, { status: 404 });
  }

  // A track can be either split across segments (a talkover chops it) OR the
  // merged "song span" can over-reach and glue distinct songs together when a
  // short DJ gap is really a boundary. Neither window wins alone, so try BOTH —
  // the merged span and the bare segment — and accept whichever AcoustID
  // matches. Bridged spans longer than a plausible song are skipped as
  // over-merges rather than fingerprinted uselessly.
  const MAX_SPAN_SEC = 420;
  const siblings = await prisma.segment.findMany({
    where: { recordingId: seg.recordingId },
    select: { id: true, startSec: true, endSec: true, type: true },
    orderBy: { startSec: "asc" },
  });
  const span = songSpan(siblings, seg.id);

  const windows: { startSec: number; endSec: number }[] = [];
  if (
    span &&
    span.endSec - span.startSec <= MAX_SPAN_SEC &&
    (span.startSec !== seg.startSec || span.endSec !== seg.endSec)
  ) {
    windows.push({ startSec: span.startSec, endSec: span.endSec });
  }
  windows.push({ startSec: seg.startSec, endSec: seg.endSec });

  const filePath = path.join(ROOT, "storage", "recordings", seg.recording.filename);

  let result;
  try {
    result = await identifyWindows(filePath, seg.id, windows);
  } catch (e) {
    console.error(`[identify] ${segmentId} failed`, e);
    return Response.json({ error: "identification failed" }, { status: 502 });
  }

  if (result.error === "no_api_key") {
    return Response.json(
      { error: "AcoustID API key not configured" },
      { status: 503 },
    );
  }
  if (result.error) {
    return Response.json({ error: result.error }, { status: 502 });
  }

  // Pass the match through untouched; nothing is written to the DB.
  return Response.json({
    matched: !!result.matched,
    title: result.title ?? null,
    artist: result.artist ?? null,
    album: result.album ?? null,
    score: result.score ?? null,
    acousticScore: result.acousticScore ?? null,
  });
}
