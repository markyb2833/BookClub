import { Suspense } from "react";
import NewReadingLogClient from "@/components/reading/NewReadingLogClient";

export default function NewReadingSessionPage() {
  return (
    <Suspense
      fallback={
        <div style={{ maxWidth: 640, margin: "0 auto", padding: "32px clamp(14px, 4vw, 20px)", width: "100%", boxSizing: "border-box", minWidth: 0 }}>
          <p style={{ color: "var(--muted)", fontSize: 14 }}>Loading…</p>
        </div>
      }
    >
      <NewReadingLogClient />
    </Suspense>
  );
}
