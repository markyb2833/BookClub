/** Last browse URL (`/books` or `/books?…`) for Nav / deep links — not a work page (`/books/:id`). */
export const BOOKS_BROWSE_SESSION_KEY = "bookclub_books_browse_href";

export function isBooksBrowseHref(h: string): boolean {
  if (h === "/books") return true;
  if (!h.startsWith("/books?")) return false;
  return true;
}
