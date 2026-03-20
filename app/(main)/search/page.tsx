import { Suspense } from "react";
import SearchClient from "./SearchClient";

export const metadata = { title: "Search" };

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div style={{ maxWidth: 680, margin: "0 auto", padding: "40px 24px 80px", color: "var(--muted)", fontSize: 14 }}>
          Loading search…
        </div>
      }
    >
      <SearchClient />
    </Suspense>
  );
}
