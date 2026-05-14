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

async function main() {
  await prisma.segment.deleteMany();
  await prisma.recording.deleteMany();
  await prisma.station.deleteMany();
  await prisma.settings.deleteMany();

  await prisma.settings.create({
    data: { key: "epoch", value: String(Date.now()) },
  });

  const station = await prisma.station.create({
    data: {
      name: "RADIO X",
      freq: "98.3",
      genre: "Test Stream",
      color: "#d4a017",
      sortOrder: 0,
    },
  });

  const filename = "Radio X.mp3";
  const filepath = path.join(process.cwd(), "storage", "recordings", filename);
  const fileSize = statSync(filepath).size;

  await prisma.recording.create({
    data: {
      stationId: station.id,
      filename,
      displayName: "Radio X — Test Recording",
      duration: 3468.336,
      fileSize,
      sortOrder: 0,
      processingStatus: "done",
      processedAt: new Date(),
    },
  });

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
