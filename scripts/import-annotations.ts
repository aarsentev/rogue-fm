/**
 * Restore stations/recordings/segments from data/annotations.json into the
 * database. Matches stations by slug and recordings by (station, slug);
 * creates whatever is missing, and REPLACES the segment list of every
 * recording present in the file.
 *
 * Meant for restoring hand-made segmentation on a fresh clone, or syncing a
 * second machine. Segments you edited after the export will be overwritten
 * for the recordings covered by the file — export first if in doubt.
 *
 * Run with: npm run db:import
 */
import "dotenv/config";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { readFileSync } from "node:fs";
import path from "node:path";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url }),
});

type SegmentJson = {
  startSec: number;
  endSec: number;
  type: string;
  confidence: number;
  label: string | null;
  trackTitle: string | null;
  trackArtist: string | null;
  trackAlbum: string | null;
  trackYear: number | null;
  manuallyEdited: boolean;
};

type RecordingJson = {
  slug: string | null;
  filename: string;
  displayName: string | null;
  duration: number;
  fileSize: number;
  sortOrder: number;
  processingStatus: string;
  segments: SegmentJson[];
};

type StationJson = {
  slug: string | null;
  name: string;
  freq: string;
  genre: string;
  color: string;
  sortOrder: number;
  recordings: RecordingJson[];
};

async function main() {
  const src = path.join(process.cwd(), "data", "annotations.json");
  const stations = JSON.parse(readFileSync(src, "utf-8")) as StationJson[];

  let segTotal = 0;

  for (const s of stations) {
    if (!s.slug) {
      console.warn(`skipping station "${s.name}" — no slug in file`);
      continue;
    }

    const station = await prisma.station.upsert({
      where: { slug: s.slug },
      update: {
        name: s.name,
        freq: s.freq,
        genre: s.genre,
        color: s.color,
        sortOrder: s.sortOrder,
      },
      create: {
        slug: s.slug,
        name: s.name,
        freq: s.freq,
        genre: s.genre,
        color: s.color,
        sortOrder: s.sortOrder,
      },
    });

    for (const r of s.recordings) {
      if (!r.slug) {
        console.warn(`skipping recording "${r.filename}" — no slug in file`);
        continue;
      }

      const existing = await prisma.recording.findFirst({
        where: { stationId: station.id, slug: r.slug },
        select: { id: true },
      });

      const recData = {
        filename: r.filename,
        displayName: r.displayName,
        duration: r.duration,
        fileSize: r.fileSize,
        sortOrder: r.sortOrder,
        processingStatus: r.processingStatus,
      };

      const rec = existing
        ? await prisma.recording.update({
            where: { id: existing.id },
            data: recData,
          })
        : await prisma.recording.create({
            data: { ...recData, stationId: station.id, slug: r.slug },
          });

      await prisma.$transaction([
        prisma.segment.deleteMany({ where: { recordingId: rec.id } }),
        prisma.segment.createMany({
          data: r.segments.map((g) => ({ ...g, recordingId: rec.id })),
        }),
      ]);
      segTotal += r.segments.length;
      console.log(
        `${s.name} / ${r.displayName ?? r.filename}: ${r.segments.length} segments`,
      );
    }
  }

  console.log(`\nimport complete — ${segTotal} segments written.`);
  console.log(
    "note: mp3 files are not in git; make sure storage/recordings/ has the files the annotations refer to.",
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
