import type { Metadata } from "next";
import { Suspense } from "react";
import FeedClient from "@/components/social/FeedClient";

export const metadata: Metadata = {
  title: "Home",
};

export default function FeedPage() {
  return (
    <Suspense fallback={<p style={{ padding: 32, color: "var(--muted)", fontSize: 14 }}>Loading…</p>}>
      <FeedClient />
    </Suspense>
  );
}
