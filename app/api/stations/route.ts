import { prisma } from "@/lib/db";
import { z } from "zod";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  name: z.string().trim().min(1).max(60),
  freq: z.string().trim().min(1).max(12),
  genre: z.string().trim().min(1).max(60),
  color: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "color must be #rrggbb"),
});

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

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "invalid input" },
      { status: 400 },
    );
  }

  const last = await prisma.station.findFirst({
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  const sortOrder = (last?.sortOrder ?? -1) + 1;

  const station = await prisma.station.create({
    data: { ...parsed.data, sortOrder },
    select: {
      id: true,
      name: true,
      freq: true,
      genre: true,
      color: true,
      sortOrder: true,
    },
  });

  return Response.json({ station }, { status: 201 });
}
