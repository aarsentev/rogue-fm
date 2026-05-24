-- AlterTable
ALTER TABLE "Segment" ADD COLUMN "trackAlbum" TEXT;
ALTER TABLE "Segment" ADD COLUMN "trackArtist" TEXT;
ALTER TABLE "Segment" ADD COLUMN "trackTitle" TEXT;
ALTER TABLE "Segment" ADD COLUMN "trackYear" INTEGER;

-- AlterTable
ALTER TABLE "Station" ADD COLUMN "logoPath" TEXT;
