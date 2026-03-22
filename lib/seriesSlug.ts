import { genreSlug } from "@/lib/openlibrary/genres";

/** URL-safe slug unique per Open Library series id (names can collide). */
export function seriesSlug(name: string, openLibraryId: string): string {
  const base = genreSlug(name).replace(/^-+|-+$/g, "") || "series";
  const suffix = openLibraryId.replace(/^\/+/, "").toLowerCase();
  const combined = `${base}-${suffix}`;
  return combined.length <= 160 ? combined : combined.slice(0, 160);
}
