export type BooksBrowseState = {
  page?: number;
  genre?: string | null;
  sort?: string;
  q?: string | null;
  author?: string | null;
  series?: string | null;
};

/** Build `/books?…` preserving browse filters for nav and in-app links. */
export function booksBrowseHref(opts: BooksBrowseState): string {
  const p = new URLSearchParams();
  const qTrim = opts.q?.trim();
  if (qTrim) p.set("q", qTrim);
  if (opts.genre) p.set("genre", opts.genre);
  if (opts.author) p.set("author", opts.author);
  if (opts.series) p.set("series", opts.series);
  if (opts.sort && opts.sort !== "popular") p.set("sort", opts.sort);
  if (opts.page && opts.page > 1) p.set("page", String(opts.page));
  const s = p.toString();
  return s ? `/books?${s}` : "/books";
}
