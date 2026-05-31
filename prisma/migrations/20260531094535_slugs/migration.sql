/*
  Warnings:

  - A unique constraint covering the columns `[stationId,slug]` on the table `Recording` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[slug]` on the table `Station` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Recording" ADD COLUMN "slug" TEXT;

-- AlterTable
ALTER TABLE "Station" ADD COLUMN "slug" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Recording_stationId_slug_key" ON "Recording"("stationId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "Station_slug_key" ON "Station"("slug");
