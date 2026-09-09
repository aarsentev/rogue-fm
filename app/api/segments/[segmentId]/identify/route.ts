import path from "node:path";
import { prisma } from "@/lib/db";
import { identifySegment } from "@/lib/identify";

export const dynamic = "force-dynamic";

const ROOT = process.cwd();

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
      recording: { select: { filename: true } },
    },
  });
  if (!seg) {
    return Response.json({ error: "Segment not found" }, { status: 404 });
  }

  const filePath = path.join(ROOT, "storage", "recordings", seg.recording.filename);

  let result;
  try {
    result = await identifySegment({
      filePath,
      startSec: seg.startSec,
      endSec: seg.endSec,
      segmentId: seg.id,
    });
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
