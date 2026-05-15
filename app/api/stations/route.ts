import { prisma } from "@/lib/db";

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
      sortOrder: true,
    },
  });
  return Response.json({ stations });
}
