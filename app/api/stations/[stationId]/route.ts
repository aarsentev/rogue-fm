import { prisma } from "@/lib/db";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

export const dynamic = "force-dynamic";

const STORAGE = path.join(process.cwd(), "storage", "recordings");

const updateSchema = z
  .object({
    name: z.string().trim().min(1).max(60).optional(),
    freq: z.string().trim().min(1).max(12).optional(),
    genre: z.string().trim().min(1).max(60).optional(),
    color: z
      .string()
      .trim()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .optional(),
  })
  .refine((o) => Object.keys(o).length > 0, {
    message: "no fields to update",
  });

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

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ stationId: string }> },
) {
  const { stationId } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "invalid input" },
      { status: 400 },
    );
  }

  const exists = await prisma.station.findUnique({
    where: { id: stationId },
    select: { id: true },
  });
  if (!exists) {
    return Response.json({ error: "Station not found" }, { status: 404 });
  }

  const station = await prisma.station.update({
    where: { id: stationId },
    data: parsed.data,
    select: {
      id: true,
      name: true,
      freq: true,
      genre: true,
      color: true,
      sortOrder: true,
    },
  });

  return Response.json({ station });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ stationId: string }> },
) {
  const { stationId } = await params;

  const station = await prisma.station.findUnique({
    where: { id: stationId },
    include: { recordings: { select: { filename: true } } },
  });
  if (!station) {
    return Response.json({ error: "Station not found" }, { status: 404 });
  }

  // Remove the mp3 files; segments + recordings cascade via the schema.
  await Promise.all(
    station.recordings.map((r) =>
      unlink(path.join(STORAGE, r.filename)).catch(() => {}),
    ),
  );

  await prisma.station.delete({ where: { id: stationId } });

  return Response.json({ deleted: true });
}
