/**
 * One-time backfill: assign slugs to stations and recordings that don't have them.
 * Run with: npm run db:backfill-slugs
 *
 * Idempotent — safe to re-run; rows that already have a slug are skipped.
 */
import "dotenv/config";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url }),
});

function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

async function main() {
  // --- stations ---
  const stations = await prisma.station.findMany({
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true, slug: true },
  });

  const usedStationSlugs = new Set(
    stations.map((s) => s.slug).filter(Boolean) as string[],
  );

  for (const s of stations) {
    if (s.slug) continue;
    const root = slugify(s.name) || "station";
    let candidate = root;
    let n = 2;
    while (usedStationSlugs.has(candidate)) candidate = `${root}-${n++}`;
    usedStationSlugs.add(candidate);
    await prisma.station.update({
      where: { id: s.id },
      data: { slug: candidate },
    });
    console.log(`station ${s.name.padEnd(20)} -> ${candidate}`);
  }

  // --- recordings (slug unique per station) ---
  const recordings = await prisma.recording.findMany({
    orderBy: [{ stationId: "asc" }, { sortOrder: "asc" }],
    select: {
      id: true,
      stationId: true,
      displayName: true,
      filename: true,
      slug: true,
    },
  });

  const usedByStation: Record<string, Set<string>> = {};
  for (const r of recordings) {
    if (!usedByStation[r.stationId]) usedByStation[r.stationId] = new Set();
    if (r.slug) usedByStation[r.stationId].add(r.slug);
  }

  for (const r of recordings) {
    if (r.slug) continue;
    const base = r.displayName ?? r.filename.replace(/\.[^.]+$/, "");
    const root = slugify(base) || "recording";
    let candidate = root;
    let n = 2;
    const used = usedByStation[r.stationId]!;
    while (used.has(candidate)) candidate = `${root}-${n++}`;
    used.add(candidate);
    await prisma.recording.update({
      where: { id: r.id },
      data: { slug: candidate },
    });
    console.log(`recording ${(r.displayName ?? r.filename).padEnd(30)} -> ${candidate}`);
  }

  console.log("\nbackfill complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
