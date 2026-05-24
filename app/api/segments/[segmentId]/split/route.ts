import { prisma } from "@/lib/db";
import { z } from "zod";

export const dynamic = "force-dynamic";

const schema = z.object({
  atSec: z.number().positive(),
});

const EPSILON = 0.05;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ segmentId: string }> },
) {
  const { segmentId } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "invalid input" },
      { status: 400 },
    );
  }

  const seg = await prisma.segment.findUnique({ where: { id: segmentId } });
  if (!seg) {
    return Response.json({ error: "Segment not found" }, { status: 404 });
  }

  const at = parsed.data.atSec;
  if (at <= seg.startSec + EPSILON || at >= seg.endSec - EPSILON) {
    return Response.json(
      { error: "split point must be inside the segment with margin" },
      { status: 400 },
    );
  }

  const [left, right] = await prisma.$transaction([
    prisma.segment.update({
      where: { id: seg.id },
      data: { endSec: at, manuallyEdited: true },
    }),
    prisma.segment.create({
      data: {
        recordingId: seg.recordingId,
        startSec: at,
        endSec: seg.endSec,
        type: seg.type,
        confidence: seg.confidence,
        // inherit label / track meta — the user usually wants to keep the
        // identification on the right half too (e.g. song split around an ad)
        label: seg.label,
        trackTitle: seg.trackTitle,
        trackArtist: seg.trackArtist,
        trackAlbum: seg.trackAlbum,
        trackYear: seg.trackYear,
        manuallyEdited: true,
      },
    }),
  ]);

  return Response.json({ left, right }, { status: 201 });
}
