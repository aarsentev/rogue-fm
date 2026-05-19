import { prisma } from "@/lib/db";
import { createWriteStream, mkdirSync } from "node:fs";
import { unlink } from "node:fs/promises";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import path from "node:path";

export const dynamic = "force-dynamic";

const STORAGE = path.join(process.cwd(), "storage", "recordings");

export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("file");
  const stationId = form.get("stationId");
  const displayNameRaw = form.get("displayName");

  if (!(file instanceof File)) {
    return Response.json({ error: "file is required" }, { status: 400 });
  }
  if (typeof stationId !== "string" || !stationId) {
    return Response.json({ error: "stationId is required" }, { status: 400 });
  }
  if (!/\.mp3$/i.test(file.name)) {
    return Response.json({ error: "only .mp3 is accepted" }, { status: 400 });
  }

  const station = await prisma.station.findUnique({
    where: { id: stationId },
    select: { id: true },
  });
  if (!station) {
    return Response.json({ error: "station not found" }, { status: 404 });
  }

  const displayName =
    typeof displayNameRaw === "string" && displayNameRaw.trim()
      ? displayNameRaw.trim()
      : file.name.replace(/\.[^.]+$/, "");

  const last = await prisma.recording.findFirst({
    where: { stationId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  const sortOrder = (last?.sortOrder ?? -1) + 1;

  const rec = await prisma.recording.create({
    data: {
      stationId,
      filename: "uploading",
      displayName,
      duration: 0,
      fileSize: file.size,
      sortOrder,
      processingStatus: "pending",
    },
  });

  const filename = `${rec.id}.mp3`;
  const dest = path.join(STORAGE, filename);

  try {
    mkdirSync(STORAGE, { recursive: true });
    await pipeline(
      Readable.fromWeb(file.stream() as Parameters<typeof Readable.fromWeb>[0]),
      createWriteStream(dest),
    );
  } catch (e) {
    console.error("[upload] write failed", e);
    await prisma.recording.delete({ where: { id: rec.id } }).catch(() => {});
    await unlink(dest).catch(() => {});
    return Response.json({ error: "failed to store file" }, { status: 500 });
  }

  await prisma.recording.update({
    where: { id: rec.id },
    data: { filename },
  });

  return Response.json(
    { id: rec.id, status: "pending" },
    { status: 201 },
  );
}
