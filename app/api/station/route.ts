import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const station = await prisma.station.findFirst({
    orderBy: { sortOrder: "asc" },
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
    return Response.json({ error: "No station" }, { status: 404 });
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
