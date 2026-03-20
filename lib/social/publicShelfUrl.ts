/** Canonical path to a visitor-facing shelf page. */
export function publicShelfHref(username: string, shelfSlug: string) {
  return `/u/${encodeURIComponent(username)}/shelves/${encodeURIComponent(shelfSlug)}`;
}
