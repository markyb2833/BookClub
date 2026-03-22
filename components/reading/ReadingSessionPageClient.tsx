"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";
import { useTheme } from "@/components/ThemeProvider";
import RichTextEditor from "@/components/editor/RichTextEditor";
import ImageAttachmentPicker, { type PickedImage } from "@/components/media/ImageAttachmentPicker";
import ReadingSessionForm from "@/components/reading/ReadingSessionForm";
import { progressPercentFromSessionSnapshot } from "@/lib/reading/workReadingProgress";
import Image from "next/image";

type SessionDto = {
  id: string;
  workId: string;
  editionId: string | null;
  date: string;
  periodStart: string;
  periodEnd: string | null;
  pagesRead: number;
  pagesTotal: number | null;
  startPage: number | null;
  endPage: number | null;
  percentComplete: number | null;
  notes: string | null;
  readingTimeMinutes: number | null;
  medium: string;
  mediumNote: string | null;
  highlights: unknown;
  readCycle: number;
  feedPostId: string | null;
  work: { id: string; title: string; coverUrl: string | null };
};

function formatMediumLabel(m: string) {
  return m.replace(/_/g, " ").replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function formatPeriodPreview(start: string, end: string | null) {
  if (!start.trim()) return "—";
  const fmt = (iso: string) => {
    const [y, mo, d] = iso.split("-").map(Number);
    if (!y || !mo || !d) return iso;
    return new Date(y, mo - 1, d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  };
  const a = fmt(start);
  if (!end) return `From ${a}`;
  if (start === end) return a;
  return `${a} – ${fmt(end)}`;
}

export default function ReadingSessionPageClient({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const { data: auth } = useSession();
  const { settings } = useTheme();
  const accent = settings.accentColour;

  const [session, setSession] = useState<SessionDto | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [composerHtml, setComposerHtml] = useState("<p></p>");
  const [composerImgs, setComposerImgs] = useState<PickedImage[]>([]);
  const [posting, setPosting] = useState(false);
  const [postErr, setPostErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadErr(null);
    try {
      const res = await fetch(`/api/reading/sessions/${sessionId}`);
      const d = (await res.json()) as { session?: SessionDto; error?: string };
      if (!res.ok) {
        setSession(null);
        setLoadErr(typeof d.error === "string" ? d.error : "Could not load");
        return;
      }
      setSession(d.session ?? null);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function publishToFeed() {
    if (!auth?.user?.id || !session || session.feedPostId) return;
    setPostErr(null);
    setPosting(true);
    try {
      const res = await fetch(`/api/reading/sessions/${sessionId}/feed-post`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: composerHtml,
          attachments: composerImgs.map((x) => ({ url: x.url, caption: x.caption || undefined })),
        }),
      });
      const d = (await res.json().catch(() => ({}))) as { error?: string; post?: { id: string } };
      if (!res.ok) {
        setPostErr(typeof d.error === "string" ? d.error : "Could not publish");
        return;
      }
      setComposerHtml("<p></p>");
      setComposerImgs([]);
      if (d.post?.id) {
        setSession((s) => (s ? { ...s, feedPostId: d.post!.id } : s));
      } else await load();
    } finally {
      setPosting(false);
    }
  }

  if (loading) {
    return (
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "32px clamp(14px, 4vw, 20px)", width: "100%", boxSizing: "border-box", minWidth: 0 }}>
        <p style={{ color: "var(--muted)", fontSize: 14 }}>Loading read log…</p>
      </div>
    );
  }

  if (loadErr || !session) {
    return (
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "32px clamp(14px, 4vw, 20px)", width: "100%", boxSizing: "border-box", minWidth: 0 }}>
        <p style={{ color: "#b91c1c", fontSize: 14 }}>{loadErr ?? "Not found"}</p>
        <Link href="/reading" style={{ color: accent, fontWeight: 600, fontSize: 14 }}>
          ← Back to calendar
        </Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "28px clamp(14px, 4vw, 20px) 80px", width: "100%", boxSizing: "border-box", minWidth: 0 }}>
      <div style={{ marginBottom: 16 }}>
        <Link href="/reading" style={{ fontSize: 13, fontWeight: 600, color: accent, textDecoration: "none" }}>
          ← Reading calendar
        </Link>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 20 }}>
        <Link
          href={`/reading/new?work=${encodeURIComponent(session.workId)}`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "8px 14px",
            borderRadius: 10,
            background: `${accent}18`,
            color: accent,
            fontWeight: 600,
            fontSize: 13,
            textDecoration: "none",
            border: `1px solid ${accent}44`,
          }}
        >
          + Another log for this book
        </Link>
        <Link
          href="/reading/new"
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "8px 14px",
            borderRadius: 10,
            border: "1px solid var(--border)",
            color: "var(--text)",
            fontWeight: 600,
            fontSize: 13,
            textDecoration: "none",
            background: "var(--surface)",
          }}
        >
          Log a different book
        </Link>
      </div>
      <h1 style={{ fontSize: "clamp(20px, 5vw, 22px)", fontWeight: 800, margin: "0 0 6px", letterSpacing: "-0.4px" }}>Edit read log</h1>
      <p style={{ fontSize: 14, color: "var(--muted)", margin: "0 0 22px", lineHeight: 1.5 }}>
        Update pages, dates, format, and highlights. Post to the community feed when you are ready.
      </p>

      <ReadingSessionForm
        mode="edit"
        sessionId={sessionId}
        initial={session}
        onSaved={() => router.push("/reading")}
      />

      <section style={{ marginTop: 36, paddingTop: 28, borderTop: "1px solid var(--border)" }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 10px" }}>Feed</h2>
        {session.feedPostId ? (
          <p style={{ fontSize: 14, color: "var(--muted)", margin: 0, lineHeight: 1.55 }}>
            This read is linked to a feed post. Open{" "}
            <Link href="/feed?view=all" style={{ color: accent, fontWeight: 600 }}>
              Discover
            </Link>{" "}
            and sort by <strong>New</strong> to see it in the community stream.
          </p>
        ) : (
          <>
            <p style={{ fontSize: 14, color: "var(--muted)", margin: "0 0 14px", lineHeight: 1.55 }}>
              The feed shows a reading card (cover, dates, pages, time, progress). Your <strong>reading notes</strong> and{" "}
              <strong>highlights</strong> from this log are appended to the post automatically. Add an optional extra note or photos below — you can publish with just the card and saved highlights.
            </p>
            <style>{`
              @media (max-width: 480px) {
                .session-feed-preview { flex-direction: column !important; align-items: stretch !important; }
                .session-feed-preview .session-feed-cover { align-self: center; }
              }
              @media (max-width: 380px) {
                .session-feed-meta { grid-template-columns: 1fr !important; }
              }
            `}</style>
            <div
              className="session-feed-preview"
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 16,
                padding: 14,
                borderRadius: 12,
                border: "1px solid var(--border)",
                background: "var(--bg)",
                marginBottom: 16,
                alignItems: "flex-start",
              }}
            >
              <div
                className="session-feed-cover"
                style={{
                  width: 56,
                  height: 84,
                  flexShrink: 0,
                  borderRadius: 8,
                  overflow: "hidden",
                  background: "var(--border)",
                  position: "relative",
                }}
              >
                {session.work.coverUrl ? (
                  <Image src={session.work.coverUrl} alt="" fill sizes="56px" style={{ objectFit: "cover" }} />
                ) : (
                  <div
                    style={{
                      fontSize: 9,
                      padding: 6,
                      color: "var(--muted)",
                      lineHeight: 1.25,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      height: "100%",
                      textAlign: "center",
                    }}
                  >
                    {session.work.title.slice(0, 24)}
                    {session.work.title.length > 24 ? "…" : ""}
                  </div>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontWeight: 800,
                    fontSize: 11,
                    color: accent,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    marginBottom: 6,
                  }}
                >
                  Reading card
                </div>
                <p style={{ margin: "0 0 12px", fontWeight: 700, fontSize: 15, lineHeight: 1.35 }}>{session.work.title}</p>
                <div
                  className="session-feed-meta"
                  style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "10px 14px", fontSize: 12 }}
                >
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.03em" }}>Period</div>
                    <div style={{ fontWeight: 600, marginTop: 2 }}>{formatPeriodPreview(session.periodStart, session.periodEnd)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.03em" }}>Pages</div>
                    <div style={{ fontWeight: 600, marginTop: 2 }}>
                      {session.pagesRead > 0 ? `${session.pagesRead} read` : "—"}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.03em" }}>Time</div>
                    <div style={{ fontWeight: 600, marginTop: 2 }}>
                      {session.readingTimeMinutes != null && session.readingTimeMinutes > 0
                        ? `${session.readingTimeMinutes} min total`
                        : "—"}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.03em" }}>Progress</div>
                    <div style={{ fontWeight: 600, marginTop: 2 }}>
                      {(() => {
                        const pc = progressPercentFromSessionSnapshot({
                          percentComplete: session.percentComplete,
                          endPage: session.endPage,
                          pagesTotal: session.pagesTotal,
                        });
                        return pc != null && Number.isFinite(pc) ? `${Math.round(pc * 10) / 10}%` : "—";
                      })()}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.03em" }}>Format</div>
                    <div style={{ fontWeight: 600, marginTop: 2 }}>{formatMediumLabel(session.medium)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.03em" }}>Read</div>
                    <div style={{ fontWeight: 600, marginTop: 2 }}>#{session.readCycle}</div>
                  </div>
                </div>
              </div>
            </div>
            {postErr ? <p style={{ color: "#b91c1c", fontSize: 13, margin: "0 0 10px" }}>{postErr}</p> : null}
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 8 }}>Optional note</label>
            <RichTextEditor value={composerHtml} onChange={setComposerHtml} placeholder="Thoughts, quotes, anything extra…" minHeight={120} />
            <div style={{ marginTop: 12 }}>
              <ImageAttachmentPicker items={composerImgs} onChange={setComposerImgs} max={12} label="Photos (optional)" />
            </div>
            <button
              type="button"
              disabled={posting || !auth?.user}
              onClick={() => void publishToFeed()}
              style={{
                marginTop: 14,
                padding: "12px 20px",
                minHeight: 44,
                borderRadius: 10,
                border: "none",
                background: accent,
                color: "#fff",
                fontWeight: 600,
                fontSize: 14,
                cursor: posting || !auth?.user ? "not-allowed" : "pointer",
                opacity: posting || !auth?.user ? 0.7 : 1,
              }}
            >
              {posting ? "Publishing…" : "Post to feed"}
            </button>
          </>
        )}
      </section>
    </div>
  );
}
