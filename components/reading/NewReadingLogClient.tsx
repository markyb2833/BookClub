"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";
import { useTheme } from "@/components/ThemeProvider";
import ReadingSessionForm, { type ReadingPrefillWork } from "@/components/reading/ReadingSessionForm";

type CurrentlyReadingBook = {
  workId: string;
  title: string;
  coverUrl: string | null;
  editionId: string | null;
};

export default function NewReadingLogClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status } = useSession();
  const { settings } = useTheme();
  const accent = settings.accentColour;

  const [formKey, setFormKey] = useState(0);
  const [prefillWork, setPrefillWork] = useState<ReadingPrefillWork | null>(null);
  const [readingNow, setReadingNow] = useState<CurrentlyReadingBook[]>([]);

  const workParam = searchParams.get("work");

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  const loadCurrentlyReading = useCallback(async () => {
    const res = await fetch("/api/reading/currently-reading");
    if (!res.ok) return;
    const d = (await res.json()) as { books?: CurrentlyReadingBook[] };
    setReadingNow(d.books ?? []);
  }, []);

  useEffect(() => {
    if (status !== "authenticated") return;
    void loadCurrentlyReading();
  }, [status, loadCurrentlyReading]);

  useEffect(() => {
    if (!workParam || !/^[0-9a-f-]{36}$/i.test(workParam)) return;
    let cancelled = false;
    void fetch(`/api/books/${workParam}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((w: { id?: string; title?: string; coverUrl?: string | null } | null) => {
        if (cancelled || !w?.id || !w.title) return;
        setPrefillWork({ id: w.id, title: w.title, coverUrl: w.coverUrl ?? null, editionId: null });
        setFormKey((k) => k + 1);
      });
    return () => {
      cancelled = true;
    };
  }, [workParam]);

  function pickReadingBook(b: CurrentlyReadingBook) {
    setPrefillWork({
      id: b.workId,
      title: b.title,
      coverUrl: b.coverUrl,
      editionId: b.editionId,
    });
    setFormKey((k) => k + 1);
  }

  if (status === "loading" || status === "unauthenticated") {
    return (
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "32px clamp(14px, 4vw, 20px)", width: "100%", boxSizing: "border-box", minWidth: 0 }}>
        <p style={{ color: "var(--muted)", fontSize: 14 }}>Loading…</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "28px clamp(14px, 4vw, 20px) 88px", width: "100%", boxSizing: "border-box", minWidth: 0 }}>
      <div style={{ marginBottom: 22 }}>
        <Link href="/reading" style={{ fontSize: 13, fontWeight: 600, color: accent, textDecoration: "none" }}>
          ← Reading calendar
        </Link>
      </div>

      <header style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: "clamp(22px, 6vw, 28px)", fontWeight: 800, margin: "0 0 10px", letterSpacing: "-0.6px", lineHeight: 1.15 }}>Log a read</h1>
        <p style={{ fontSize: 15, color: "var(--muted)", margin: 0, lineHeight: 1.55, maxWidth: 520 }}>
          Optionally share to the feed in one step. Everything still appears on your calendar; open a session later to edit or post.
        </p>
      </header>

      {readingNow.length > 0 && (
        <section style={{ marginBottom: 26 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Currently reading</h2>
            <Link href="/shelves/currently-reading" style={{ fontSize: 13, fontWeight: 600, color: accent, textDecoration: "none" }}>
              Manage shelf →
            </Link>
          </div>
          <div
            style={{
              display: "flex",
              gap: 12,
              overflowX: "auto",
              paddingBottom: 6,
              WebkitOverflowScrolling: "touch",
            }}
          >
            {readingNow.map((b) => (
              <button
                key={b.workId}
                type="button"
                onClick={() => pickReadingBook(b)}
                style={{
                  flex: "0 0 auto",
                  width: 132,
                  padding: 12,
                  borderRadius: 14,
                  border: prefillWork?.id === b.workId ? `2px solid ${accent}` : "1px solid var(--border)",
                  background: "var(--surface)",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <div style={{ width: "100%", aspectRatio: "2/3", borderRadius: 8, overflow: "hidden", background: "var(--border)", position: "relative", marginBottom: 10 }}>
                  {b.coverUrl ? (
                    <Image src={b.coverUrl} alt="" fill sizes="120px" style={{ objectFit: "cover" }} />
                  ) : (
                    <span style={{ fontSize: 11, padding: 8, color: "var(--muted)", display: "block" }}>{b.title.slice(0, 24)}</span>
                  )}
                </div>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, lineHeight: 1.35, color: "var(--text)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                  {b.title}
                </p>
                <span style={{ fontSize: 11, fontWeight: 600, color: accent, marginTop: 8, display: "inline-block" }}>Log session →</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <ReadingSessionForm
        key={formKey}
        mode="create"
        prefillWork={prefillWork}
        onSaved={() => router.push("/reading")}
      />
    </div>
  );
}
