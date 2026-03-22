"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { BOOKS_BROWSE_SESSION_KEY, isBooksBrowseHref } from "@/lib/booksBrowseSession";

/**
 * While on `/books`, mirrors the current query string into sessionStorage.
 * Elsewhere, reads that value so Nav "Books" returns to the same filters/page/search.
 *
 * Initial render must not read sessionStorage (server vs client mismatch). We only
 * read storage after mount; on `/books` the href always comes from the URL so SSR
 * and hydration match.
 */
export function useBooksNavHref(): string {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [sessionBrowseHref, setSessionBrowseHref] = useState<string | null>(null);

  const booksHrefFromRoute =
    pathname === "/books"
      ? searchParams.toString()
        ? `/books?${searchParams.toString()}`
        : "/books"
      : null;

  useEffect(() => {
    if (pathname === "/books") {
      const h = searchParams.toString() ? `/books?${searchParams.toString()}` : "/books";
      try {
        sessionStorage.setItem(BOOKS_BROWSE_SESSION_KEY, h);
      } catch {
        /* private mode */
      }
      setSessionBrowseHref(h);
      return;
    }
    try {
      const s = sessionStorage.getItem(BOOKS_BROWSE_SESSION_KEY);
      setSessionBrowseHref(s && isBooksBrowseHref(s) ? s : "/books");
    } catch {
      setSessionBrowseHref("/books");
    }
  }, [pathname, searchParams]);

  return booksHrefFromRoute ?? sessionBrowseHref ?? "/books";
}
