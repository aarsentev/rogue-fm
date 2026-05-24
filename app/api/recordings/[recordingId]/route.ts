import { prisma } from "@/lib/db";
import { isProcessing } from "@/lib/processing";
import { z } from "zod";

export const dynamic = "force-dynamic";

const patchSchema = z
  .object({
    duration: z.number().positive().optional(),
    displayName: z.string().trim().min(1).max(200).nullable().optional(),
  })
  .refine((o) => Object.keys(o).length > 0, {
    message: "no fields to update",
  });

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ recordingId: string }> },
) {
  const { recordingId } = await params;

  const rec = await prisma.recording.findUnique({
    where: { id: recordingId },
    include: {
      segments: {
        orderBy: { startSec: "asc" },
        select: {
          id: true,
          startSec: true,
          endSec: true,
          type: true,
          confidence: true,
          label: true,
          trackTitle: true,
          trackArtist: true,
          trackAlbum: true,
          trackYear: true,
          manuallyEdited: true,
        },
      },
    },
  });

  if (!rec) {
    return Response.json({ error: "Recording not found" }, { status: 404 });
  }

  return Response.json({
    id: rec.id,
    stationId: rec.stationId,
    filename: rec.filename,
    displayName: rec.displayName,
    duration: rec.duration,
    processingStatus: rec.processingStatus,
    processedAt: rec.processedAt,
    processing: isProcessing(rec.id),
    segments: rec.segments,
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ recordingId: string }> },
) {
  const { recordingId } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "invalid input" },
      { status: 400 },
    );
  }

  const existing = await prisma.recording.findUnique({
    where: { id: recordingId },
    select: { id: true },
  });
  if (!existing) {
    return Response.json({ error: "Recording not found" }, { status: 404 });
  }

  // duration must cover every existing segment.
  if (parsed.data.duration !== undefined) {
    const last = await prisma.segment.findFirst({
      where: { recordingId },
      orderBy: { endSec: "desc" },
      select: { endSec: true },
    });
    if (last && parsed.data.duration + 0.05 < last.endSec) {
      return Response.json(
        {
          error: `duration ${parsed.data.duration.toFixed(1)}s is shorter than the last segment (ends at ${last.endSec.toFixed(1)}s)`,
        },
        { status: 400 },
      );
    }
  }

  const updated = await prisma.recording.update({
    where: { id: recordingId },
    data: parsed.data,
    select: {
      id: true,
      duration: true,
      displayName: true,
    },
  });

  return Response.json({ recording: updated });
}
