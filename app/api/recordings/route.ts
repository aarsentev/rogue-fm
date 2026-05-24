import { prisma } from "@/lib/db";
import { isProcessing } from "@/lib/processing";

export const dynamic = "force-dynamic";

export async function GET() {
  const stations = await prisma.station.findMany({
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      name: true,
      freq: true,
      genre: true,
      color: true,
      logoPath: true,
      recordings: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          filename: true,
          displayName: true,
          duration: true,
          fileSize: true,
          uploadedAt: true,
          processedAt: true,
          processingStatus: true,
          _count: { select: { segments: true } },
        },
      },
    },
  });

  const result = stations.map((s) => ({
    id: s.id,
    name: s.name,
    freq: s.freq,
    genre: s.genre,
    color: s.color,
    logoPath: s.logoPath,
    recordings: s.recordings.map((r) => ({
      id: r.id,
      filename: r.filename,
      displayName: r.displayName,
      duration: r.duration,
      fileSize: r.fileSize,
      uploadedAt: r.uploadedAt,
      processedAt: r.processedAt,
      processingStatus: r.processingStatus,
      segmentCount: r._count.segments,
      processing: isProcessing(r.id),
    })),
  }));

  return Response.json({ stations: result });
}
