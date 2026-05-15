import "dotenv/config";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { statSync } from "node:fs";
import path from "node:path";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url }),
});

type StationSeed = {
  name: string;
  freq: string;
  genre: string;
  color: string;
  recordings: { filename: string; displayName: string; duration: number }[];
};

const STATIONS: StationSeed[] = [
  {
    name: "FLASH FM",
    freq: "98.3",
    genre: "Dance · Pop",
    color: "#d4a017",
    recordings: [
      { filename: "Flash FM.mp3", displayName: "Flash FM — Vol. 1", duration: 3792.117 },
    ],
  },
  {
    name: "WAVE 103",
    freq: "103.9",
    genre: "New Wave · Synthpop",
    color: "#0288d1",
    recordings: [
      { filename: "Wave 103.mp3", displayName: "Wave 103 — Vol. 1", duration: 3666.103 },
    ],
  },
  {
    name: "RADIO X",
    freq: "104.7",
    genre: "Alternative Rock",
    color: "#c0392b",
    recordings: [
      { filename: "Radio X.mp3", displayName: "Radio X — Vol. 1", duration: 3468.336 },
    ],
  },
  {
    name: "VLADIVOSTOK FM",
    freq: "92.4",
    genre: "Russian Pop",
    color: "#9b6dcc",
    recordings: [
      { filename: "Vladivostok FM.mp3", displayName: "Vladivostok FM — Vol. 1", duration: 2930.160 },
    ],
  },
];

async function main() {
  await prisma.segment.deleteMany();
  await prisma.recording.deleteMany();
  await prisma.station.deleteMany();
  await prisma.settings.deleteMany();

  await prisma.settings.create({
    data: { key: "epoch", value: String(Date.now()) },
  });

  for (let i = 0; i < STATIONS.length; i++) {
    const s = STATIONS[i];
    const station = await prisma.station.create({
      data: {
        name: s.name,
        freq: s.freq,
        genre: s.genre,
        color: s.color,
        sortOrder: i,
      },
    });

    for (let j = 0; j < s.recordings.length; j++) {
      const r = s.recordings[j];
      const filepath = path.join(
        process.cwd(),
        "storage",
        "recordings",
        r.filename,
      );
      const fileSize = statSync(filepath).size;
      await prisma.recording.create({
        data: {
          stationId: station.id,
          filename: r.filename,
          displayName: r.displayName,
          duration: r.duration,
          fileSize,
          sortOrder: j,
          processingStatus: "done",
          processedAt: new Date(),
        },
      });
    }
  }

  console.log(`Seed complete: ${STATIONS.length} stations.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
