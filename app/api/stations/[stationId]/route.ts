import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ stationId: string }> },
) {
  const { stationId } = await params;

  const station = await prisma.station.findUnique({
    where: { id: stationId },
    include: {
      recordings: {
        where: { processingStatus: "done" },
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          filename: true,
          displayName: true,
          duration: true,
          sortOrder: true,
        },
      },
    },
  });

  if (!station) {
    return Response.json({ error: "Station not found" }, { status: 404 });
  }

  const epochRow = await prisma.settings.findUnique({ where: { key: "epoch" } });
  const epoch = epochRow ? Number(epochRow.value) : Date.now();

  const totalDuration = station.recordings.reduce(
    (s, r) => s + r.duration,
    0,
  );

  return Response.json({
    station: {
      id: station.id,
      name: station.name,
      freq: station.freq,
      genre: station.genre,
      color: station.color,
    },
    recordings: station.recordings,
    totalDuration,
    epoch,
  });
}
