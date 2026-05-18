import { prisma } from "@/lib/db";
import { processRecording, isProcessing } from "@/lib/processing";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ recordingId: string }> },
) {
  const { recordingId } = await params;

  const rec = await prisma.recording.findUnique({
    where: { id: recordingId },
    select: { id: true, processingStatus: true },
  });
  if (!rec) {
    return Response.json({ error: "Recording not found" }, { status: 404 });
  }

  if (isProcessing(recordingId) || rec.processingStatus === "processing") {
    return Response.json({ status: "processing" }, { status: 202 });
  }

  // Fire-and-forget: the local node server keeps the promise alive.
  void processRecording(recordingId);

  return Response.json({ status: "processing" }, { status: 202 });
}
