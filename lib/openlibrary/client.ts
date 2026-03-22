const BASE = "https://openlibrary.org";
const COVERS = "https://covers.openlibrary.org";
const UA = process.env.OPENLIBRARY_USER_AGENT ?? "BookClub/0.1 (local-dev)";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "User-Agent": UA },
    next: { revalidate: 60 * 60 * 24 }, // cache 24h in Next.js fetch cache
  });
  if (!res.ok) throw new Error(`OpenLibrary ${path} → ${res.status}`);
  return res.json();
}

export function coverUrl(coverId: number, size: "S" | "M" | "L" = "M") {
  return `${COVERS}/b/id/${coverId}-${size}.jpg`;
}

// ---- Search ----------------------------------------------------------------

export interface OLSearchResult {
  numFound: number;
  docs: OLSearchDoc[];
}

export interface OLSearchDoc {
  key: string;           // e.g. "/works/OL45883W"
  title: string;
  subtitle?: string;
  author_name?: string[];
  author_key?: string[];
  first_publish_year?: number;
  subject?: string[];
  cover_i?: number;
  cover_edition_key?: string;
  ratings_average?: number;
  ratings_count?: number;
  number_of_pages_median?: number;
  edition_count?: number;
  type?: string;
}

export async function searchBooks(
  query: string,
  page = 1,
  limit = 20
): Promise<OLSearchResult> {
  const offset = (page - 1) * limit;
  return get(
    `/search.json?q=${encodeURIComponent(query)}&limit=${limit}&offset=${offset}&fields=key,title,subtitle,author_name,author_key,first_publish_year,subject,cover_i,cover_edition_key,ratings_average,ratings_count,edition_count,type`
  );
}

// ---- Work ------------------------------------------------------------------

/** Open Library work → series link (when catalogued). */
export interface OLSeriesRef {
  series?: { key: string };
  position?: string;
}

export interface OLWork {
  key: string;
  title: string;
  description?: string | { value: string };
  subjects?: string[];
  covers?: number[];
  first_publish_date?: string;
  authors?: { author: { key: string } }[];
  series?: OLSeriesRef[];
}

export async function getWork(olKey: string): Promise<OLWork> {
  const path = olKey.endsWith(".json") ? olKey : `${olKey.replace(/\/$/, "")}.json`;
  return get(path.startsWith("/") ? path : `/${path}`);
}

export interface OLSeriesDoc {
  key?: string;
  name?: string;
  description?: string | { value: string };
}

export async function getSeries(olSeriesKey: string): Promise<OLSeriesDoc> {
  const base = olSeriesKey.replace(/\.json$/i, "").replace(/\/$/, "");
  const path = base.startsWith("/") ? `${base}.json` : `/${base}.json`;
  return get(path);
}

// ---- Author ----------------------------------------------------------------

export interface OLAuthor {
  key: string;
  name: string;
  bio?: string | { value: string };
  birth_date?: string;
  death_date?: string;
  photos?: number[];
}

export async function getAuthor(olKey: string): Promise<OLAuthor> {
  return get(`${olKey}.json`);
}

// ---- Editions --------------------------------------------------------------

export interface OLEditionsResult {
  entries: OLEdition[];
}

export interface OLEdition {
  key: string;
  title?: string;
  isbn_10?: string[];
  isbn_13?: string[];
  publishers?: string[];
  publish_date?: string;
  number_of_pages?: number;
  languages?: { key: string }[];
  covers?: number[];
  physical_format?: string;
}

export async function getEditions(workOlKey: string): Promise<OLEditionsResult> {
  return get(`${workOlKey}/editions.json?limit=10`);
}
