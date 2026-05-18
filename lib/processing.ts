import { spawn } from "node:child_process";
import path from "node:path";
import { prisma } from "@/lib/db";

const ROOT = process.cwd();
const PY = path.join(ROOT, "ml", ".venv", "bin", "python");
const SCRIPT = path.join(ROOT, "ml", "process.py");

// brew installs ffmpeg here; ensure the child can find it regardless of how
// `next` was launched.
const EXTRA_PATH = ["/opt/homebrew/bin", "/usr/local/bin"];

type ProcSegment = {
  startSec: number;
  endSec: number;
  type: string;
  confidence: number;
};

type ProcResult = {
  id?: string;
  duration?: number;
  segments?: ProcSegment[];
  error?: string;
};

const inFlight = new Set<string>();

export function isProcessing(recordingId: string): boolean {
  return inFlight.has(recordingId);
}

function runPython(filePath: string, recordingId: string): Promise<ProcResult> {
  return new Promise((resolve, reject) => {
    const env = {
      ...process.env,
      PATH: `${EXTRA_PATH.join(":")}:${process.env.PATH ?? ""}`,
    };
    const child = spawn(
      PY,
      [SCRIPT, "--file", filePath, "--id", recordingId],
      { env },
    );

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));

    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        console.error(`[processing] python exited ${code}\n${stderr}`);
      }
      try {
        resolve(JSON.parse(stdout.trim()) as ProcResult);
      } catch {
        reject(
          new Error(
            `bad python output (exit ${code}): ${stdout.slice(0, 200)}`,
          ),
        );
      }
    });
  });
}

/**
 * Fire-and-forget pipeline: mark processing, spawn Python, replace segments,
 * mark done/failed. Caller returns immediately; client polls the recording.
 */
export async function processRecording(recordingId: string): Promise<void> {
  if (inFlight.has(recordingId)) return;
  inFlight.add(recordingId);

  try {
    const rec = await prisma.recording.findUnique({
      where: { id: recordingId },
    });
    if (!rec) {
      inFlight.delete(recordingId);
      return;
    }

    await prisma.recording.update({
      where: { id: recordingId },
      data: { processingStatus: "processing" },
    });

    const filePath = path.join(
      ROOT,
      "storage",
      "recordings",
      rec.filename,
    );

    const result = await runPython(filePath, recordingId);

    if (result.error || !result.segments) {
      await prisma.recording.update({
        where: { id: recordingId },
        data: { processingStatus: "failed" },
      });
      console.error(
        `[processing] ${recordingId} failed: ${result.error ?? "no segments"}`,
      );
      return;
    }

    await prisma.$transaction([
      prisma.segment.deleteMany({ where: { recordingId } }),
      prisma.segment.createMany({
        data: result.segments.map((s) => ({
          recordingId,
          startSec: s.startSec,
          endSec: s.endSec,
          type: s.type,
          confidence: s.confidence,
        })),
      }),
      prisma.recording.update({
        where: { id: recordingId },
        data: {
          processingStatus: "done",
          processedAt: new Date(),
          ...(result.duration && result.duration > 0
            ? { duration: result.duration }
            : {}),
        },
      }),
    ]);

    console.log(
      `[processing] ${recordingId} done: ${result.segments.length} segments`,
    );
  } catch (e) {
    console.error(`[processing] ${recordingId} crashed`, e);
    await prisma.recording
      .update({
        where: { id: recordingId },
        data: { processingStatus: "failed" },
      })
      .catch(() => {});
  } finally {
    inFlight.delete(recordingId);
  }
}
