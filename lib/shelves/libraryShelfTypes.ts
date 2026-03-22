/** Shared model for LibraryWall / ShelfScene (importable from server loaders). */

export interface LibraryWorkAuthor {
  name: string;
}
export interface LibraryWork {
  id: string;
  title: string;
  coverUrl: string | null;
  averageRating: number;
  ratingsCount?: number;
  communityRatingAvg?: number;
  communityReviewCount?: number;
  recommendationsReceivedCount?: number;
  /** From latest reading session for this user; null if none or not derivable. */
  readingProgressPercent?: number | null;
  workAuthors: { author: LibraryWorkAuthor }[];
}
export interface LibraryShelfBook {
  work: LibraryWork;
  sortOrder: number;
  layoutXPct?: number;
  layoutYPct?: number;
  layoutZ?: number;
  /** null/undefined = inherit shelf `sceneBookDisplay` */
  sceneDisplay?: string | null;
  sceneWidthMul?: number | null;
  sceneHeightMul?: number | null;
}
export interface LibraryShelfOrnament {
  id: string;
  glyph: string;
  imageUrl?: string | null;
  xPct: number;
  yPct: number;
  zIndex: number;
  scale: number;
}
export interface LibraryShelf {
  id: string;
  name: string;
  emoji: string | null;
  slug: string;
  isPublic: boolean;
  sortOrder: number;
  bgColour: string | null;
  accentColour: string | null;
  titleColour: string | null;
  lightingPreset: string | null;
  sceneTierCount: number;
  /** spine (narrow) or cover (2:3 portrait block). */
  sceneBookDisplay?: string | null;
  sceneBookWidthMul?: number | null;
  sceneBookHeightMul?: number | null;
  books: LibraryShelfBook[];
  ornaments: LibraryShelfOrnament[];
  _count: { books: number };
}
