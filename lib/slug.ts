import { prisma } from "@/lib/db";

/**
 * Turn an arbitrary display string into a URL-safe slug.
 * "FLASH FM" -> "flash-fm"
 * "Radio X — Vol. 2" -> "radio-x-vol-2"
 */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip combining marks
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/**
 * Find a station slug that doesn't collide. Appends -2, -3, ...
 */
export async function uniqueStationSlug(
  base: string,
  ignoreId?: string,
): Promise<string> {
  const root = slugify(base) || "station";
  let candidate = root;
  let n = 2;
  // sequential probe; station table is tiny
  for (;;) {
    const existing = await prisma.station.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!existing || existing.id === ignoreId) return candidate;
    candidate = `${root}-${n++}`;
  }
}

/**
 * Find a recording slug unique within the station. Appends -2, -3, ...
 */
export async function uniqueRecordingSlug(
  base: string,
  stationId: string,
  ignoreId?: string,
): Promise<string> {
  const root = slugify(base) || "recording";
  let candidate = root;
  let n = 2;
  for (;;) {
    const existing = await prisma.recording.findFirst({
      where: { stationId, slug: candidate },
      select: { id: true },
    });
    if (!existing || existing.id === ignoreId) return candidate;
    candidate = `${root}-${n++}`;
  }
}
