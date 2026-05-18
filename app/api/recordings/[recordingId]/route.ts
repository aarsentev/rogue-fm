import { prisma } from "@/lib/db";
import { isProcessing } from "@/lib/processing";

export const dynamic = "force-dynamic";

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
