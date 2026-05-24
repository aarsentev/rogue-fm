import { prisma } from "@/lib/db";
import { createReadStream, statSync } from "node:fs";
import { Readable } from "node:stream";
import path from "node:path";

export const dynamic = "force-dynamic";

const STORAGE = path.join(process.cwd(), "storage", "logos");

const MIME_BY_EXT: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  svg: "image/svg+xml",
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ stationId: string }> },
) {
  const { stationId } = await params;
  const station = await prisma.station.findUnique({
    where: { id: stationId },
    select: { logoPath: true },
  });
  if (!station?.logoPath) {
    return new Response("No logo", { status: 404 });
  }
  const filepath = path.join(STORAGE, station.logoPath);
  let stat;
  try {
    stat = statSync(filepath);
  } catch {
    return new Response("Logo missing on disk", { status: 404 });
  }
  const ext = path.extname(station.logoPath).slice(1).toLowerCase();
  const mime = MIME_BY_EXT[ext] ?? "application/octet-stream";

  const stream = createReadStream(filepath);
  return new Response(Readable.toWeb(stream) as ReadableStream, {
    status: 200,
    headers: {
      "Content-Type": mime,
      "Content-Length": String(stat.size),
      "Cache-Control": "public, max-age=60",
    },
  });
}
