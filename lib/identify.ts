import { spawn } from "node:child_process";
import path from "node:path";

const ROOT = process.cwd();
const PY = path.join(ROOT, "ml", ".venv", "bin", "python");
const SCRIPT = path.join(ROOT, "ml", "identify.py");

// brew installs fpcalc (chromaprint) and ffmpeg here; make sure the child can
// find them regardless of how `next` was launched.
const EXTRA_PATH = ["/opt/homebrew/bin", "/usr/local/bin"];

export type IdentifyResult = {
  id?: string;
  matched?: boolean;
  score?: number;
  mbid?: string;
  title?: string;
  artist?: string;
  album?: string;
  // set when a fingerprint matched but the AcoustID entry has no linked
  // MusicBrainz recording — acoustically known, metadata unknown.
  acousticScore?: number;
  error?: string;
};

/**
 * Fingerprint one segment's audio and look it up on AcoustID via identify.py.
 * Returns the parsed result; the caller decides what (if anything) to persist.
 */
export function identifySegment(args: {
  filePath: string;
  startSec: number;
  endSec: number;
  segmentId: string;
}): Promise<IdentifyResult> {
  return new Promise((resolve, reject) => {
    const env = {
      ...process.env,
      PATH: `${EXTRA_PATH.join(":")}:${process.env.PATH ?? ""}`,
    };
    const child = spawn(
      PY,
      [
        SCRIPT,
        "--file", args.filePath,
        "--start", String(args.startSec),
        "--end", String(args.endSec),
        "--id", args.segmentId,
      ],
      { env },
    );

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));

    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        console.error(`[identify] python exited ${code}\n${stderr}`);
      }
      try {
        resolve(JSON.parse(stdout.trim()) as IdentifyResult);
      } catch {
        reject(
          new Error(`bad python output (exit ${code}): ${stdout.slice(0, 200)}`),
        );
      }
    });
  });
}
