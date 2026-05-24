import { prisma } from "@/lib/db";
import { SEGMENT_TYPES } from "@/lib/skipLogic";
import { z } from "zod";

export const dynamic = "force-dynamic";

const patchSchema = z
  .object({
    type: z.enum(SEGMENT_TYPES).optional(),
    label: z.string().trim().max(200).nullable().optional(),
    startSec: z.number().nonnegative().optional(),
    endSec: z.number().nonnegative().optional(),
    trackTitle: z.string().trim().max(200).nullable().optional(),
    trackArtist: z.string().trim().max(200).nullable().optional(),
    trackAlbum: z.string().trim().max(200).nullable().optional(),
    trackYear: z.number().int().min(1900).max(2100).nullable().optional(),
  })
  .refine((o) => Object.keys(o).length > 0, {
    message: "no fields to update",
  });

export async function PATCH(
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

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "invalid input" },
      { status: 400 },
    );
  }

  const existing = await prisma.segment.findUnique({
    where: { id: segmentId },
    select: {
      id: true,
      startSec: true,
      endSec: true,
      recordingId: true,
    },
  });
  if (!existing) {
    return Response.json({ error: "Segment not found" }, { status: 404 });
  }

  const newStart = parsed.data.startSec ?? existing.startSec;
  const newEnd = parsed.data.endSec ?? existing.endSec;
  if (newEnd <= newStart) {
    return Response.json(
      { error: "endSec must be greater than startSec" },
      { status: 400 },
    );
  }

  const updated = await prisma.segment.update({
    where: { id: segmentId },
    data: {
      ...parsed.data,
      manuallyEdited: true,
    },
  });

  return Response.json({ segment: updated });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ segmentId: string }> },
) {
  const { segmentId } = await params;
  const existing = await prisma.segment.findUnique({
    where: { id: segmentId },
    select: { id: true },
  });
  if (!existing) {
    return Response.json({ error: "Segment not found" }, { status: 404 });
  }
  await prisma.segment.delete({ where: { id: segmentId } });
  return Response.json({ deleted: true });
}
