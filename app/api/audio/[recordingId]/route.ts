import { prisma } from "@/lib/db";
import { createReadStream, statSync } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ recordingId: string }> },
) {
  const { recordingId } = await params;
  const recording = await prisma.recording.findUnique({
    where: { id: recordingId },
  });
  if (!recording) {
    return new Response("Not found", { status: 404 });
  }

  const filepath = path.join(
    process.cwd(),
    "storage",
    "recordings",
    recording.filename,
  );

  let stat;
  try {
    stat = statSync(filepath);
  } catch {
    return new Response("File missing on disk", { status: 404 });
  }

  const fileSize = stat.size;
  const range = req.headers.get("range");

  if (!range) {
    const stream = createReadStream(filepath);
    return new Response(Readable.toWeb(stream) as ReadableStream, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": String(fileSize),
        "Accept-Ranges": "bytes",
      },
    });
  }

  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  if (!match) {
    return new Response("Invalid range", { status: 416 });
  }
  const start = match[1] ? parseInt(match[1], 10) : 0;
  const end = match[2] ? parseInt(match[2], 10) : fileSize - 1;

  if (start >= fileSize || end >= fileSize || start > end) {
    return new Response("Range not satisfiable", {
      status: 416,
      headers: { "Content-Range": `bytes */${fileSize}` },
    });
  }

  const chunkSize = end - start + 1;
  const stream = createReadStream(filepath, { start, end });

  return new Response(Readable.toWeb(stream) as ReadableStream, {
    status: 206,
    headers: {
      "Content-Type": "audio/mpeg",
      "Content-Length": String(chunkSize),
      "Content-Range": `bytes ${start}-${end}/${fileSize}`,
      "Accept-Ranges": "bytes",
    },
  });
}
