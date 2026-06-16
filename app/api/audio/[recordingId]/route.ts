import { prisma } from "@/lib/db";
import { createReadStream, statSync } from "node:fs";
import path from "node:path";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

function streamFile(
  filepath: string,
  start: number,
  end: number,
  signal: AbortSignal,
): ReadableStream<Uint8Array> {
  const node = createReadStream(filepath, { start, end });

  const onAbort = () => node.destroy();
  signal.addEventListener("abort", onAbort);

  return new ReadableStream<Uint8Array>({
    start(controller) {
      node.on("data", (chunk: string | Buffer) => {
        const buf = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
        try {
          controller.enqueue(new Uint8Array(buf));
        } catch {
          node.destroy();
          return;
        }
        if (controller.desiredSize !== null && controller.desiredSize <= 0) {
          node.pause();
        }
      });
      node.on("end", () => {
        try {
          controller.close();
        } catch {
          // already closed
        }
        signal.removeEventListener("abort", onAbort);
      });
      node.on("error", (err) => {
        try {
          controller.error(err);
        } catch {
          // already errored/closed
        }
        signal.removeEventListener("abort", onAbort);
      });
    },
    pull() {
      node.resume();
    },
    cancel() {
      node.destroy();
      signal.removeEventListener("abort", onAbort);
    },
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ recordingId: string }> },
) {
  const { recordingId } = await params;
  const recording = await prisma.recording.findUnique({
    where: { id: recordingId },
    select: { filename: true },
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
    return new Response(
      streamFile(filepath, 0, fileSize - 1, req.signal),
      {
        status: 200,
        headers: {
          "Content-Type": "audio/mpeg",
          "Content-Length": String(fileSize),
          "Accept-Ranges": "bytes",
        },
      },
    );
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

  return new Response(streamFile(filepath, start, end, req.signal), {
    status: 206,
    headers: {
      "Content-Type": "audio/mpeg",
      "Content-Length": String(end - start + 1),
      "Content-Range": `bytes ${start}-${end}/${fileSize}`,
      "Accept-Ranges": "bytes",
    },
  });
}
