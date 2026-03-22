"use client";

import Link from "next/link";
import { useBooksNavHref } from "@/components/NavBooksHref";

export default function BrowseBooksBackLink() {
  const href = useBooksNavHref();
  return (
    <Link
      href={href}
      style={{
        fontSize: 13,
        fontWeight: 500,
        color: "var(--muted)",
        textDecoration: "none",
        marginBottom: 20,
        display: "inline-block",
      }}
    >
      ← Back to browse
    </Link>
  );
}
