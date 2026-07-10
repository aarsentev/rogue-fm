/**
 * Dump stations, recordings and their segments to data/annotations.json.
 * The JSON is deterministic (stable ordering, 2-space indent) so git diffs
 * stay readable. This is the canonical, versioned form of the hand-made
 * segmentation work — dev.db itself is gitignored.
 *
 * Run with: npm run db:export
 */
import "dotenv/config";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url }),
});

async function main() {
  const stations = await prisma.station.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      recordings: {
        orderBy: { sortOrder: "asc" },
        include: {
          segments: { orderBy: { startSec: "asc" } },
        },
      },
    },
  });

  const out = stations.map((s) => ({
    slug: s.slug,
    name: s.name,
    freq: s.freq,
    genre: s.genre,
    color: s.color,
    sortOrder: s.sortOrder,
    recordings: s.recordings.map((r) => ({
      slug: r.slug,
      filename: r.filename,
      displayName: r.displayName,
      duration: r.duration,
      fileSize: r.fileSize,
      sortOrder: r.sortOrder,
      processingStatus: r.processingStatus,
      segments: r.segments.map((g) => ({
        startSec: g.startSec,
        endSec: g.endSec,
        type: g.type,
        confidence: g.confidence,
        label: g.label,
        trackTitle: g.trackTitle,
        trackArtist: g.trackArtist,
        trackAlbum: g.trackAlbum,
        trackYear: g.trackYear,
        manuallyEdited: g.manuallyEdited,
      })),
    })),
  }));

  const dir = path.join(process.cwd(), "data");
  mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, "annotations.json");
  writeFileSync(dest, JSON.stringify(out, null, 2) + "\n");

  const nRec = out.reduce((n, s) => n + s.recordings.length, 0);
  const nSeg = out.reduce(
    (n, s) => n + s.recordings.reduce((m, r) => m + r.segments.length, 0),
    0,
  );
  const nEdited = out.reduce(
    (n, s) =>
      n +
      s.recordings.reduce(
        (m, r) => m + r.segments.filter((g) => g.manuallyEdited).length,
        0,
      ),
    0,
  );
  console.log(
    `exported ${out.length} stations, ${nRec} recordings, ${nSeg} segments (${nEdited} hand-edited) -> data/annotations.json`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
