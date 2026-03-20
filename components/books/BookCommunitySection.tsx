"use client";

import Image from "next/image";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";
import { useTheme } from "@/components/ThemeProvider";
import RichTextEditor from "@/components/editor/RichTextEditor";
import SafeRichHtml from "@/components/editor/SafeRichHtml";
import AttachmentStrip from "@/components/media/AttachmentStrip";
import ImageAttachmentPicker, { type PickedImage } from "@/components/media/ImageAttachmentPicker";
import { HalfStarRatingDisplay, HalfStarRatingInput } from "@/components/books/HalfStarRating";

type UserMini = { id: string; username: string; displayName: string | null; tier: string };
type AttMini = { id: string; url: string; caption: string | null };
type ReviewRow = {
  id: string;
  rating: unknown;
  body: string | null;
  containsSpoilers: boolean;
  isFeatured: boolean;
  upvotesCount: number;
  downvotesCount: number;
  commentsCount: number;
  createdAt: string;
  user: UserMini;
  votes?: { value: number }[];
  attachments?: AttMini[];
};
type CommentRow = {
  id: string;
  body: string;
  upvotesCount: number;
  downvotesCount: number;
  createdAt: string;
  user: { id: string; username: string; displayName: string | null };
  votes?: { value: number }[];
  attachments?: AttMini[];
};
type RecRow = {
  id: string;
  body: string;
  upvotesCount: number;
  downvotesCount: number;
  commentsCount: number;
  createdAt: string;
  user: UserMini;
  work: { id: string; title: string; coverUrl: string | null };
  contextWork: { id: string; title: string } | null;
  votes?: { value: number }[];
  attachments?: AttMini[];
};

/** Meilisearch work document (snake_case) for recommendation picker */
type RecSearchHit = {
  id: string;
  title: string;
  subtitle: string | null;
  authors: string[];
  description: string | null;
  average_rating: number | null;
  ratings_count: number | null;
  cover_url: string | null;
  first_published: string | null;
};

function normalizeRecSearchHit(raw: Record<string, unknown>, excludeWorkId: string): RecSearchHit | null {
  const id = String(raw.id ?? "");
  if (!id || id === excludeWorkId) return null;
  const title = String(raw.title ?? "").trim();
  if (!title) return null;
  const authorsRaw = raw.authors;
  const authors = Array.isArray(authorsRaw) ? authorsRaw.map((a) => String(a)) : [];
  const ar = raw.average_rating;
  const rc = raw.ratings_count;
  return {
    id,
    title,
    subtitle: raw.subtitle != null ? String(raw.subtitle) : null,
    authors,
    description: raw.description != null ? String(raw.description) : null,
    average_rating: typeof ar === "number" && Number.isFinite(ar) ? ar : ar != null ? Number(ar) : null,
    ratings_count: typeof rc === "number" && Number.isFinite(rc) ? rc : rc != null ? Number(rc) : null,
    cover_url: raw.cover_url != null ? String(raw.cover_url) : null,
    first_published: raw.first_published != null ? String(raw.first_published) : null,
  };
}

/** Puts title + primary author in the search box so Meilisearch refines results after pick */
function queryAfterPick(h: RecSearchHit): string {
  const by = h.authors[0]?.trim();
  return by ? `${h.title} ${by}` : h.title;
}

function blurbExcerpt(text: string | null, max = 140): string {
  if (!text?.trim()) return "";
  const t = text.replace(/\s+/g, " ").trim();
  return t.length <= max ? t : `${t.slice(0, max)}…`;
}

function VotePair({
  up,
  down,
  myVote,
  onVote,
  disabled,
}: {
  up: number;
  down: number;
  myVote: number;
  onVote: (v: 1 | -1 | 0) => void;
  disabled?: boolean;
}) {
  const { settings } = useTheme();
  const a = settings.accentColour;
  const btn = (active: boolean) =>
    ({
      padding: "4px 10px",
      borderRadius: 8,
      border: `1px solid ${active ? a : "var(--border)"}`,
      background: active ? `${a}18` : "var(--bg)",
      color: active ? a : "var(--muted)",
      fontSize: 12,
      fontWeight: 600,
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.5 : 1,
    }) as const;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
      <button type="button" disabled={disabled} style={btn(myVote === 1)} onClick={() => onVote(myVote === 1 ? 0 : 1)}>
        ↑ {up}
      </button>
      <button type="button" disabled={disabled} style={btn(myVote === -1)} onClick={() => onVote(myVote === -1 ? 0 : -1)}>
        ↓ {down}
      </button>
      <span style={{ fontSize: 12, color: "var(--muted)" }}>score {up - down}</span>
    </div>
  );
}

export default function BookCommunitySection({
  workId,
  workTitle,
  hiddenProfileUserIds,
  initialReviewCount,
}: {
  workId: string;
  workTitle: string;
  hiddenProfileUserIds: string[];
  initialReviewCount: number;
}) {
  const { data: session } = useSession();
  const { settings } = useTheme();
  const accent = settings.accentColour;
  const hidden = new Set(hiddenProfileUserIds);
  const sessionId = session?.user?.id ?? null;

  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [recIn, setRecIn] = useState<RecRow[]>([]);
  const [recFrom, setRecFrom] = useState<RecRow[]>([]);

  const [rating, setRating] = useState<number | null>(null);
  const [bodyHtml, setBodyHtml] = useState("<p></p>");
  const [spoiler, setSpoiler] = useState(false);
  const [saving, setSaving] = useState(false);
  const [recBody, setRecBody] = useState("<p></p>");
  const [recQuery, setRecQuery] = useState("");
  const [recHits, setRecHits] = useState<RecSearchHit[]>([]);
  const [recSearchLoading, setRecSearchLoading] = useState(false);
  const [recPick, setRecPick] = useState<RecSearchHit | null>(null);
  const [recSaving, setRecSaving] = useState(false);
  const [reviewImages, setReviewImages] = useState<PickedImage[]>([]);
  const [recImages, setRecImages] = useState<PickedImage[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, rec] = await Promise.all([
        fetch(`/api/works/${workId}/reviews`).then((x) => x.json()),
        fetch(`/api/works/${workId}/recommendations`).then((x) => x.json()),
      ]);
      setReviews(r.reviews ?? []);
      setRecIn(rec.recommendingThisBook ?? []);
      setRecFrom(rec.fromThisBook ?? []);
    } finally {
      setLoading(false);
    }
  }, [workId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!recQuery.trim()) {
      setRecHits([]);
      setRecSearchLoading(false);
      return;
    }
    const t = setTimeout(() => {
      setRecSearchLoading(true);
      void fetch(`/api/search?q=${encodeURIComponent(recQuery)}`)
        .then((r) => r.json())
        .then((d: { hits?: Record<string, unknown>[] }) => {
          const next: RecSearchHit[] = [];
          for (const h of d.hits ?? []) {
            const row = normalizeRecSearchHit(h, workId);
            if (row) next.push(row);
            if (next.length >= 8) break;
          }
          setRecHits(next);
        })
        .catch(() => setRecHits([]))
        .finally(() => setRecSearchLoading(false));
    }, 350);
    return () => clearTimeout(t);
  }, [recQuery, workId]);

  async function saveReview() {
    if (!session?.user) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/works/${workId}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating,
          body: bodyHtml,
          containsSpoilers: spoiler,
          attachments: reviewImages.map((x) => ({ url: x.url, caption: x.caption || undefined })),
        }),
      });
      if (!res.ok) {
        const e = (await res.json().catch(() => ({}))) as { error?: string };
        alert(e.error ?? "Could not save review");
        return;
      }
      setBodyHtml("<p></p>");
      setRating(null);
      setSpoiler(false);
      setReviewImages([]);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function voteReview(reviewId: string, value: 1 | -1 | 0) {
    if (!session?.user) return;
    const res = await fetch(`/api/reviews/${reviewId}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value }),
    });
    if (!res.ok) return;
    const d = (await res.json()) as { upvotesCount: number; downvotesCount: number; myVote: number };
    setReviews((prev) =>
      prev.map((r) =>
        r.id === reviewId
          ? { ...r, upvotesCount: d.upvotesCount, downvotesCount: d.downvotesCount, votes: [{ value: d.myVote }] }
          : r,
      ),
    );
  }

  async function saveRecommendation() {
    if (!session?.user || !recPick) return;
    setRecSaving(true);
    try {
      const res = await fetch(`/api/works/${workId}/recommendations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recommendedWorkId: recPick.id,
          body: recBody,
          attachments: recImages.map((x) => ({ url: x.url, caption: x.caption || undefined })),
        }),
      });
      if (!res.ok) {
        const e = (await res.json().catch(() => ({}))) as { error?: string };
        alert(e.error ?? "Could not save");
        return;
      }
      setRecBody("<p></p>");
      setRecPick(null);
      setRecQuery("");
      setRecImages([]);
      await load();
    } finally {
      setRecSaving(false);
    }
  }

  async function voteRec(id: string, value: 1 | -1 | 0) {
    if (!session?.user) return;
    const res = await fetch(`/api/book-recommendations/${id}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value }),
    });
    if (!res.ok) return;
    const d = (await res.json()) as { upvotesCount: number; downvotesCount: number; myVote: number };
    const patch = (rows: RecRow[]) =>
      rows.map((r) =>
        r.id === id
          ? { ...r, upvotesCount: d.upvotesCount, downvotesCount: d.downvotesCount, votes: [{ value: d.myVote }] }
          : r,
      );
    setRecIn((p) => patch(p));
    setRecFrom((p) => patch(p));
  }

  const reviewCountDisplay = loading ? initialReviewCount : reviews.length;

  return (
    <>
      <section style={{ borderTop: "1px solid var(--border)", paddingTop: 28 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>
            Reviews
            <span style={{ fontSize: 14, fontWeight: 400, color: "var(--muted)", marginLeft: 8 }}>({reviewCountDisplay})</span>
          </h2>
        </div>

        {session?.user && (
          <div style={{ marginBottom: 28, padding: 18, borderRadius: 14, border: `1.5px solid ${accent}33`, background: "var(--surface)" }}>
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Your review</p>
            <div style={{ marginBottom: 12 }}>
              <HalfStarRatingInput value={rating} onChange={setRating} accent={accent} />
            </div>
            <RichTextEditor value={bodyHtml} onChange={setBodyHtml} placeholder="What did you think?" />
            <div style={{ marginTop: 12 }} onClick={(e) => e.stopPropagation()}>
              <ImageAttachmentPicker items={reviewImages} onChange={setReviewImages} max={12} label="Attach images" />
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, fontSize: 13, color: "var(--muted)", cursor: "pointer" }}>
              <input type="checkbox" checked={spoiler} onChange={(e) => setSpoiler(e.target.checked)} />
              Contains spoilers
            </label>
            <button
              type="button"
              disabled={saving}
              onClick={() => void saveReview()}
              style={{
                marginTop: 12,
                padding: "10px 18px",
                borderRadius: 10,
                border: "none",
                background: accent,
                color: "#fff",
                fontWeight: 600,
                fontSize: 14,
                cursor: saving ? "not-allowed" : "pointer",
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? "Saving…" : "Save review"}
            </button>
          </div>
        )}

        {loading ? (
          <p style={{ color: "var(--muted)", fontSize: 14 }}>Loading reviews…</p>
        ) : reviews.length === 0 ? (
          <div style={{ borderRadius: 12, border: "1.5px dashed var(--border)", padding: "40px 0", textAlign: "center", color: "var(--muted)", fontSize: 14 }}>
            No reviews yet — be the first!
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {reviews.map((review) => (
              <ReviewCard
                key={review.id}
                review={review}
                hidden={hidden}
                onVote={voteReview}
                sessionId={sessionId}
                sessionUser={sessionId ? { id: sessionId } : null}
                onRefresh={load}
              />
            ))}
          </div>
        )}
      </section>

      <section style={{ borderTop: "1px solid var(--border)", paddingTop: 28, marginTop: 36 }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>Recommendations</h2>
        <p style={{ fontSize: 14, color: "var(--muted)", marginBottom: 20, lineHeight: 1.5 }}>
          Link another book in BookClub and explain why you recommend it{workTitle ? ` (often read after “${workTitle}”)` : ""}.
        </p>

        {session?.user && (
          <div style={{ marginBottom: 28, padding: 18, borderRadius: 14, border: "1px solid var(--border)", background: "var(--surface)" }}>
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Write a recommendation</p>
            <div style={{ position: "relative", marginBottom: 12 }}>
              <input
                value={recQuery}
                onChange={(e) => setRecQuery(e.target.value)}
                placeholder="Search book to recommend…"
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid var(--border)",
                  fontSize: 14,
                  background: "var(--bg)",
                  color: "var(--text)",
                }}
              />
              {(recHits.length > 0 || recSearchLoading) && recQuery.trim() && (
                <div
                  style={{
                    position: "absolute",
                    zIndex: 20,
                    left: 0,
                    right: 0,
                    top: "100%",
                    marginTop: 4,
                    borderRadius: 10,
                    border: "1px solid var(--border)",
                    background: "var(--surface)",
                    maxHeight: 400,
                    overflowY: "auto",
                    boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                  }}
                >
                  {recSearchLoading && recHits.length === 0 ? (
                    <p style={{ margin: 0, padding: "14px 12px", fontSize: 13, color: "var(--muted)" }}>Searching…</p>
                  ) : null}
                  {recHits.map((h) => {
                    const authorsLine = h.authors.length > 0 ? h.authors.join(", ") : null;
                    const blur = blurbExcerpt(h.description);
                    const rating = h.average_rating != null && h.average_rating > 0 ? h.average_rating : null;
                    return (
                      <button
                        key={h.id}
                        type="button"
                        onClick={() => {
                          setRecPick(h);
                          setRecHits([]);
                          setRecQuery(queryAfterPick(h));
                        }}
                        style={{
                          display: "flex",
                          gap: 12,
                          width: "100%",
                          textAlign: "left",
                          padding: "10px 12px",
                          border: "none",
                          borderBottom: "1px solid var(--border)",
                          background: "transparent",
                          cursor: "pointer",
                          color: "var(--text)",
                          alignItems: "flex-start",
                        }}
                      >
                        <div
                          style={{
                            width: 48,
                            height: 72,
                            flexShrink: 0,
                            borderRadius: 6,
                            overflow: "hidden",
                            background: "var(--border)",
                            position: "relative",
                          }}
                        >
                          {h.cover_url ? (
                            <Image src={h.cover_url} alt="" fill sizes="48px" style={{ objectFit: "cover" }} />
                          ) : (
                            <span
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                height: "100%",
                                fontSize: 11,
                                fontWeight: 700,
                                color: "var(--muted)",
                                padding: 4,
                                textAlign: "center",
                              }}
                            >
                              {h.title.slice(0, 3)}
                            </span>
                          )}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.3 }}>{h.title}</div>
                          {h.subtitle ? (
                            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2, lineHeight: 1.35 }}>{h.subtitle}</div>
                          ) : null}
                          {authorsLine ? (
                            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>{authorsLine}</div>
                          ) : null}
                          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 6 }}>
                            {rating != null ? (
                              <>
                                <HalfStarRatingDisplay rating={rating} fontSize={13} />
                                <span style={{ fontSize: 11, color: "var(--muted)" }}>
                                  {rating.toFixed(1)}
                                  {h.ratings_count != null && h.ratings_count > 0
                                    ? ` · ${h.ratings_count.toLocaleString()} ratings`
                                    : ""}
                                </span>
                              </>
                            ) : (
                              <span style={{ fontSize: 11, color: "var(--muted)" }}>No community rating yet</span>
                            )}
                            {h.first_published ? (
                              <span style={{ fontSize: 11, color: "var(--muted)" }}>· {h.first_published}</span>
                            ) : null}
                          </div>
                          {blur ? (
                            <p
                              style={{
                                margin: "8px 0 0",
                                fontSize: 12,
                                color: "var(--muted)",
                                lineHeight: 1.45,
                                display: "-webkit-box",
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: "vertical",
                                overflow: "hidden",
                              }}
                            >
                              {blur}
                            </p>
                          ) : null}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            {recPick && (
              <div
                style={{
                  display: "flex",
                  gap: 12,
                  alignItems: "flex-start",
                  marginBottom: 10,
                  padding: 12,
                  borderRadius: 10,
                  border: `1px solid ${accent}33`,
                  background: "var(--bg)",
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 66,
                    flexShrink: 0,
                    borderRadius: 6,
                    overflow: "hidden",
                    background: "var(--border)",
                    position: "relative",
                  }}
                >
                  {recPick.cover_url ? (
                    <Image src={recPick.cover_url} alt="" fill sizes="44px" style={{ objectFit: "cover" }} />
                  ) : (
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        height: "100%",
                        fontSize: 10,
                        fontWeight: 700,
                        color: "var(--muted)",
                      }}
                    >
                      {recPick.title.slice(0, 2)}
                    </span>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    Selected
                  </p>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: "var(--text)", lineHeight: 1.35 }}>{recPick.title}</p>
                  {recPick.authors.length > 0 ? (
                    <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--muted)" }}>{recPick.authors.join(", ")}</p>
                  ) : null}
                  {recPick.average_rating != null && recPick.average_rating > 0 ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
                      <HalfStarRatingDisplay rating={recPick.average_rating} fontSize={12} />
                      <span style={{ fontSize: 11, color: "var(--muted)" }}>
                        {recPick.average_rating.toFixed(1)}
                        {recPick.ratings_count != null && recPick.ratings_count > 0
                          ? ` · ${recPick.ratings_count.toLocaleString()} ratings`
                          : ""}
                      </span>
                    </div>
                  ) : null}
                </div>
              </div>
            )}
            <RichTextEditor value={recBody} onChange={setRecBody} placeholder="Why this book?" minHeight={120} />
            <div style={{ marginTop: 12 }} onClick={(e) => e.stopPropagation()}>
              <ImageAttachmentPicker items={recImages} onChange={setRecImages} max={12} label="Attach images" />
            </div>
            <button
              type="button"
              disabled={recSaving || !recPick}
              onClick={() => void saveRecommendation()}
              style={{
                marginTop: 12,
                padding: "10px 18px",
                borderRadius: 10,
                border: "none",
                background: accent,
                color: "#fff",
                fontWeight: 600,
                fontSize: 14,
                cursor: recSaving || !recPick ? "not-allowed" : "pointer",
                opacity: recSaving || !recPick ? 0.6 : 1,
              }}
            >
              {recSaving ? "Saving…" : "Publish recommendation"}
            </button>
          </div>
        )}

        {recIn.length > 0 && (
          <>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--muted)", marginBottom: 12 }}>Readers recommend this book</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
              {recIn.map((r) => (
                <RecCard
                  key={r.id}
                  r={r}
                  hidden={hidden}
                  onVote={voteRec}
                  sessionId={sessionId}
                  sessionUser={sessionId ? { id: sessionId } : null}
                  onRefresh={load}
                />
              ))}
            </div>
          </>
        )}

        {recFrom.length > 0 && (
          <>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--muted)", marginBottom: 12 }}>If you liked this book…</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {recFrom.map((r) => (
                <RecCard
                  key={r.id}
                  r={r}
                  hidden={hidden}
                  onVote={voteRec}
                  sessionId={sessionId}
                  sessionUser={sessionId ? { id: sessionId } : null}
                  onRefresh={load}
                />
              ))}
            </div>
          </>
        )}
      </section>
    </>
  );
}

function RecCard({
  r,
  hidden,
  onVote,
  sessionId,
  sessionUser,
  onRefresh,
}: {
  r: RecRow;
  hidden: Set<string>;
  onVote: (id: string, v: 1 | -1 | 0) => void;
  sessionId: string | null;
  sessionUser: { id: string } | null;
  onRefresh: () => Promise<void>;
}) {
  const [openComments, setOpenComments] = useState(false);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [loadingC, setLoadingC] = useState(false);
  const [draft, setDraft] = useState("");
  const [commentImgs, setCommentImgs] = useState<PickedImage[]>([]);
  const hide = hidden.has(r.user.id);
  const name = r.user.displayName ?? r.user.username;
  const myVote = r.votes?.[0]?.value ?? 0;
  const isRecAuthor = sessionUser?.id === r.user.id;

  async function loadRecComments() {
    setLoadingC(true);
    try {
      const res = await fetch(`/api/book-recommendations/${r.id}/comments`);
      const d = (await res.json()) as { comments: CommentRow[] };
      setComments(d.comments ?? []);
    } finally {
      setLoadingC(false);
    }
  }

  useEffect(() => {
    if (openComments && comments.length === 0 && !loadingC) void loadRecComments();
  }, [openComments]); // eslint-disable-line react-hooks/exhaustive-deps

  async function postRecComment() {
    if (!sessionId) return;
    if (!draft.trim() && commentImgs.length === 0) return;
    const res = await fetch(`/api/book-recommendations/${r.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        body: draft,
        attachments: commentImgs.map((x) => ({ url: x.url, caption: x.caption || undefined })),
      }),
    });
    if (!res.ok) return;
    setDraft("");
    setCommentImgs([]);
    await loadRecComments();
    await onRefresh();
  }

  async function voteRecComment(commentId: string, value: 1 | -1 | 0) {
    if (!sessionId) return;
    const res = await fetch(`/api/book-rec-comments/${commentId}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value }),
    });
    if (!res.ok) return;
    const d = (await res.json()) as { upvotesCount: number; downvotesCount: number; myVote: number };
    setComments((prev) =>
      prev.map((c) =>
        c.id === commentId
          ? { ...c, upvotesCount: d.upvotesCount, downvotesCount: d.downvotesCount, votes: [{ value: d.myVote }] }
          : c,
      ),
    );
  }

  async function delRecComment(commentId: string) {
    if (!sessionId) return;
    const res = await fetch(`/api/book-recommendations/${r.id}/comments/${commentId}`, { method: "DELETE" });
    if (!res.ok) return;
    await loadRecComments();
    await onRefresh();
  }

  return (
    <div style={{ borderRadius: 12, border: "1px solid var(--border)", padding: 16, background: "var(--surface)" }}>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <Link href={`/books/${r.work.id}`} style={{ flexShrink: 0 }}>
          <div style={{ width: 48, height: 72, borderRadius: 6, overflow: "hidden", background: "var(--border)", position: "relative" }}>
            {r.work.coverUrl ? (
              <Image src={r.work.coverUrl} alt="" fill style={{ objectFit: "cover" }} sizes="48px" />
            ) : (
              <span style={{ fontSize: 10, padding: 4, color: "var(--muted)" }}>{r.work.title.slice(0, 12)}</span>
            )}
          </div>
        </Link>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
            <Link href={`/books/${r.work.id}`} style={{ fontWeight: 700, fontSize: 15, color: "var(--text)", textDecoration: "none" }}>
              {r.work.title}
            </Link>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>by {hide ? <span>{name}</span> : <Link href={`/u/${encodeURIComponent(r.user.username)}`}>{name}</Link>}</span>
          </div>
          <SafeRichHtml html={r.body} />
          <AttachmentStrip attachments={r.attachments ?? []} />
          <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
            <VotePair up={r.upvotesCount} down={r.downvotesCount} myVote={myVote} onVote={(v) => onVote(r.id, v)} disabled={!sessionId} />
            <button
              type="button"
              onClick={() => setOpenComments((o) => !o)}
              style={{ fontSize: 12, color: "var(--accent)", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}
            >
              Comments ({r.commentsCount})
            </button>
          </div>

          {openComments && (
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
              {loadingC ? (
                <p style={{ fontSize: 13, color: "var(--muted)" }}>Loading…</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {comments.map((c) => {
                    const canDel = sessionUser && (sessionUser.id === c.user.id || isRecAuthor);
                    const cv = c.votes?.[0]?.value ?? 0;
                    return (
                      <div key={c.id} style={{ fontSize: 13, padding: 10, borderRadius: 8, background: "var(--bg)" }}>
                        <div style={{ fontWeight: 600, marginBottom: 4 }}>{c.user.displayName ?? c.user.username}</div>
                        {c.body.trim() ? (
                          <p style={{ margin: 0, color: "var(--text)", lineHeight: 1.5 }}>{c.body}</p>
                        ) : null}
                        {(c.attachments?.length ?? 0) > 0 ? <AttachmentStrip attachments={c.attachments ?? []} size={44} /> : null}
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                          <VotePair up={c.upvotesCount} down={c.downvotesCount} myVote={cv} onVote={(v) => void voteRecComment(c.id, v)} disabled={!sessionId} />
                          {canDel && (
                            <button type="button" onClick={() => void delRecComment(c.id)} style={{ fontSize: 11, color: "#b91c1c", background: "none", border: "none", cursor: "pointer" }}>
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {sessionId && (
                <div style={{ marginTop: 12, display: "flex", gap: 8, flexDirection: "column" }}>
                  <div onClick={(e) => e.stopPropagation()}>
                    <ImageAttachmentPicker items={commentImgs} onChange={setCommentImgs} max={6} label="Comment images" showCaptions={false} />
                  </div>
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Write a comment…"
                    rows={2}
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      borderRadius: 8,
                      border: "1px solid var(--border)",
                      padding: 10,
                      fontSize: 13,
                      background: "var(--bg)",
                      color: "var(--text)",
                      resize: "vertical",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => void postRecComment()}
                    style={{
                      alignSelf: "flex-start",
                      padding: "8px 14px",
                      borderRadius: 8,
                      border: "none",
                      background: "var(--accent)",
                      color: "#fff",
                      fontWeight: 600,
                      fontSize: 13,
                      cursor: "pointer",
                    }}
                  >
                    Post
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ReviewCard({
  review,
  hidden,
  onVote,
  sessionId,
  sessionUser,
  onRefresh,
}: {
  review: ReviewRow;
  hidden: Set<string>;
  onVote: (id: string, v: 1 | -1 | 0) => void;
  sessionId: string | null;
  sessionUser: { id: string } | null;
  onRefresh: () => Promise<void>;
}) {
  const [openComments, setOpenComments] = useState(false);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [loadingC, setLoadingC] = useState(false);
  const [draft, setDraft] = useState("");
  const [commentImgs, setCommentImgs] = useState<PickedImage[]>([]);
  const hide = hidden.has(review.user.id);
  const name = review.user.displayName ?? review.user.username;
  const myVote = review.votes?.[0]?.value ?? 0;

  async function loadComments() {
    setLoadingC(true);
    try {
      const res = await fetch(`/api/reviews/${review.id}/comments`);
      const d = (await res.json()) as { comments: CommentRow[] };
      setComments(d.comments ?? []);
    } finally {
      setLoadingC(false);
    }
  }

  useEffect(() => {
    if (openComments && comments.length === 0 && !loadingC) void loadComments();
  }, [openComments]); // eslint-disable-line react-hooks/exhaustive-deps

  async function postComment() {
    if (!sessionId) return;
    if (!draft.trim() && commentImgs.length === 0) return;
    const res = await fetch(`/api/reviews/${review.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        body: draft,
        attachments: commentImgs.map((x) => ({ url: x.url, caption: x.caption || undefined })),
      }),
    });
    if (!res.ok) return;
    setDraft("");
    setCommentImgs([]);
    await loadComments();
    await onRefresh();
  }

  async function voteComment(commentId: string, value: 1 | -1 | 0) {
    if (!sessionId) return;
    const res = await fetch(`/api/review-comments/${commentId}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value }),
    });
    if (!res.ok) return;
    const d = (await res.json()) as { upvotesCount: number; downvotesCount: number; myVote: number };
    setComments((prev) =>
      prev.map((c) =>
        c.id === commentId
          ? { ...c, upvotesCount: d.upvotesCount, downvotesCount: d.downvotesCount, votes: [{ value: d.myVote }] }
          : c,
      ),
    );
  }

  async function delComment(commentId: string) {
    if (!sessionId) return;
    const res = await fetch(`/api/reviews/${review.id}/comments/${commentId}`, { method: "DELETE" });
    if (!res.ok) return;
    await loadComments();
    await onRefresh();
  }

  const isReviewAuthor = sessionUser?.id === review.user.id;

  return (
    <div style={{ borderRadius: 12, background: "var(--surface)", border: "1px solid var(--border)", padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            background: "var(--accent)",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 12,
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {name.charAt(0).toUpperCase()}
        </div>
        {hide ? (
          <span style={{ fontWeight: 600, fontSize: 14, color: "var(--text)" }}>{name}</span>
        ) : (
          <Link href={`/u/${encodeURIComponent(review.user.username)}`} style={{ fontWeight: 600, fontSize: 14, color: "var(--text)", textDecoration: "none" }}>
            {name}
          </Link>
        )}
        {review.rating != null ? <HalfStarRatingDisplay rating={Number(review.rating)} fontSize={15} /> : null}
        {review.isFeatured && (
          <span style={{ marginLeft: "auto", fontSize: 11, background: "#fef3c7", color: "#92400e", border: "1px solid #fde68a", borderRadius: 999, padding: "2px 8px", fontWeight: 600 }}>
            Featured
          </span>
        )}
      </div>

      {review.containsSpoilers ? (
        <details style={{ fontSize: 13 }}>
          <summary style={{ cursor: "pointer", color: "var(--muted)" }}>⚠ Spoilers</summary>
          <div style={{ marginTop: 10 }}>
            <SafeRichHtml html={review.body ?? ""} />
          </div>
        </details>
      ) : (
        <SafeRichHtml html={review.body ?? ""} />
      )}

      <AttachmentStrip attachments={review.attachments ?? []} />

      <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
        <VotePair up={review.upvotesCount} down={review.downvotesCount} myVote={myVote} onVote={(v) => onVote(review.id, v)} disabled={!sessionId} />
        <button
          type="button"
          onClick={() => setOpenComments((o) => !o)}
          style={{ fontSize: 12, color: "var(--accent)", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}
        >
          Comments ({review.commentsCount})
        </button>
        <span style={{ fontSize: 12, color: "var(--muted)" }}>
          {new Date(review.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
        </span>
      </div>

      {openComments && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
          {loadingC ? (
            <p style={{ fontSize: 13, color: "var(--muted)" }}>Loading…</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {comments.map((c) => {
                const canDel = sessionUser && (sessionUser.id === c.user.id || isReviewAuthor);
                const cv = c.votes?.[0]?.value ?? 0;
                return (
                  <div key={c.id} style={{ fontSize: 13, padding: 10, borderRadius: 8, background: "var(--bg)" }}>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>{c.user.displayName ?? c.user.username}</div>
                    {c.body.trim() ? (
                      <p style={{ margin: 0, color: "var(--text)", lineHeight: 1.5 }}>{c.body}</p>
                    ) : null}
                    {(c.attachments?.length ?? 0) > 0 ? <AttachmentStrip attachments={c.attachments ?? []} size={44} /> : null}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                      <VotePair up={c.upvotesCount} down={c.downvotesCount} myVote={cv} onVote={(v) => void voteComment(c.id, v)} disabled={!sessionId} />
                      {canDel && (
                        <button type="button" onClick={() => void delComment(c.id)} style={{ fontSize: 11, color: "#b91c1c", background: "none", border: "none", cursor: "pointer" }}>
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {sessionId && (
            <div style={{ marginTop: 12, display: "flex", gap: 8, flexDirection: "column" }}>
              <div onClick={(e) => e.stopPropagation()}>
                <ImageAttachmentPicker items={commentImgs} onChange={setCommentImgs} max={6} label="Comment images" showCaptions={false} />
              </div>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Write a comment…"
                rows={2}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  padding: 10,
                  fontSize: 13,
                  background: "var(--bg)",
                  color: "var(--text)",
                  resize: "vertical",
                }}
              />
              <button
                type="button"
                onClick={() => void postComment()}
                style={{ alignSelf: "flex-start", padding: "8px 14px", borderRadius: 8, border: "none", background: "var(--accent)", color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
              >
                Post
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
