import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  {
    params,
  }: { params: Promise<{ stationSlug: string; recordingSlug: string }> },
) {
  const { stationSlug, recordingSlug } = await params;

  const station = await prisma.station.findUnique({
    where: { slug: stationSlug },
    select: { id: true },
  });
  if (!station) {
    return Response.json({ error: "Station not found" }, { status: 404 });
  }

  const recording = await prisma.recording.findFirst({
    where: { stationId: station.id, slug: recordingSlug },
    select: { id: true, stationId: true },
  });
  if (!recording) {
    return Response.json({ error: "Recording not found" }, { status: 404 });
  }

  return Response.json({
    recordingId: recording.id,
    stationId: recording.stationId,
  });
}
