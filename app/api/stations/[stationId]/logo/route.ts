import { prisma } from "@/lib/db";
import { createWriteStream, mkdirSync } from "node:fs";
import { unlink } from "node:fs/promises";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import path from "node:path";

export const dynamic = "force-dynamic";

const STORAGE = path.join(process.cwd(), "storage", "logos");

const EXT_BY_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

export async function POST(
  req: Request,
  { params }: { params: Promise<{ stationId: string }> },
) {
  const { stationId } = await params;

  const station = await prisma.station.findUnique({
    where: { id: stationId },
    select: { id: true, logoPath: true },
  });
  if (!station) {
    return Response.json({ error: "Station not found" }, { status: 404 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "file is required" }, { status: 400 });
  }
  const ext =
    EXT_BY_TYPE[file.type] ??
    (file.name.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase() ?? "");
  if (!ext || !Object.values(EXT_BY_TYPE).includes(ext)) {
    return Response.json(
      { error: "unsupported image type (png/jpg/webp/svg only)" },
      { status: 400 },
    );
  }

  mkdirSync(STORAGE, { recursive: true });
  const filename = `${stationId}.${ext}`;
  const dest = path.join(STORAGE, filename);

  // Drop any previous logo (could be a different extension).
  if (station.logoPath && station.logoPath !== filename) {
    await unlink(path.join(STORAGE, station.logoPath)).catch(() => {});
  }

  try {
    await pipeline(
      Readable.fromWeb(file.stream() as Parameters<typeof Readable.fromWeb>[0]),
      createWriteStream(dest),
    );
  } catch (e) {
    console.error("[logo] write failed", e);
    return Response.json({ error: "failed to store file" }, { status: 500 });
  }

  await prisma.station.update({
    where: { id: stationId },
    data: { logoPath: filename },
  });

  return Response.json({ logoPath: filename });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ stationId: string }> },
) {
  const { stationId } = await params;
  const station = await prisma.station.findUnique({
    where: { id: stationId },
    select: { logoPath: true },
  });
  if (!station) {
    return Response.json({ error: "Station not found" }, { status: 404 });
  }
  if (station.logoPath) {
    await unlink(path.join(STORAGE, station.logoPath)).catch(() => {});
    await prisma.station.update({
      where: { id: stationId },
      data: { logoPath: null },
    });
  }
  return Response.json({ deleted: true });
}
