"use client";

import Image from "next/image";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTheme } from "@/components/ThemeProvider";
import RichTextEditor from "@/components/editor/RichTextEditor";
import SafeRichHtml from "@/components/editor/SafeRichHtml";
import AttachmentStrip from "@/components/media/AttachmentStrip";
import ImageAttachmentPicker, { type PickedImage } from "@/components/media/ImageAttachmentPicker";
import ImageCarouselLightbox, { type CarouselImage } from "@/components/media/ImageCarouselLightbox";
import { HalfStarRatingDisplay } from "@/components/books/HalfStarRating";
import { richTextToPlain } from "@/lib/sanitizeRichText";
import type { CSSProperties } from "react";

type Sort = "new" | "top" | "trending";

type UserMini = { id: string; username: string; displayName: string | null; tier: string };
type WorkMini = { id: string; title: string; coverUrl: string | null };
type AttMini = { id: string; url: string; caption: string | null };

type FeedItem =
  | {
      kind: "review";
      id: string;
      createdAt: string;
      score: number;
      myVote: number;
      review: {
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
        work: WorkMini;
        attachments: AttMini[];
      };
    }
  | {
      kind: "recommendation";
      id: string;
      createdAt: string;
      score: number;
      myVote: number;
      recommendation: {
        id: string;
        body: string;
        upvotesCount: number;
        downvotesCount: number;
        commentsCount: number;
        createdAt: string;
        user: UserMini;
        work: WorkMini;
        contextWork: { id: string; title: string } | null;
        attachments: AttMini[];
      };
    }
  | {
      kind: "feed_post";
      id: string;
      createdAt: string;
      score: number;
      myVote: number;
      feedPost: {
        id: string;
        body: string | null;
        upvotesCount: number;
        downvotesCount: number;
        commentsCount: number;
        createdAt: string;
        user: UserMini;
        attachments: AttMini[];
        readingLog?: {
          sessionId: string;
          readCycle: number;
          medium: string;
          periodStart: string;
          periodEnd: string | null;
          pagesRead: number;
          readingTimeMinutes: number | null;
          progressPercent: number | null;
          work: WorkMini;
        };
      };
    };

function tabStyle(active: boolean, accent: string): CSSProperties {
  return {
    padding: "8px 14px",
    borderRadius: 999,
    border: `1px solid ${active ? accent : "var(--border)"}`,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    background: active ? accent : "var(--surface)",
    color: active ? "#fff" : "var(--muted)",
  };
}

function excerpt(html: string | null, max = 220): string {
  if (!html) return "";
  const t = richTextToPlain(html);
  return t.length <= max ? t : `${t.slice(0, max)}…`;
}

function fmtReadingDay(iso: string) {
  const d = new Date(iso.includes("T") ? iso : `${iso}T12:00:00.000Z`);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function fmtReadingMedium(m: string) {
  if (!m) return "";
  return m.replace(/_/g, " ").replace(/\b\w/g, (ch) => ch.toUpperCase());
}

/** Avoid `res.json()` throwing (e.g. HTML error pages, empty body, Safari quirks). */
function parseJsonBody<T>(raw: string): T | null {
  const t = raw.trim();
  if (!t) return null;
  try {
    return JSON.parse(t) as T;
  } catch {
    return null;
  }
}

function VoteRow({
  up,
  down,
  myVote,
  onVote,
  disabled,
  accent,
}: {
  up: number;
  down: number;
  myVote: number;
  onVote: (v: 1 | -1 | 0) => void;
  disabled?: boolean;
  accent: string;
}) {
  const btn = (active: boolean) =>
    ({
      padding: "4px 10px",
      borderRadius: 8,
      border: `1px solid ${active ? accent : "var(--border)"}`,
      background: active ? `${accent}18` : "var(--bg)",
      color: active ? accent : "var(--muted)",
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

type FeedCommentRow = {
  id: string;
  body: string;
  user: UserMini;
  upvotesCount: number;
  downvotesCount: number;
  votes?: { value: number }[];
  attachments: AttMini[];
};

function FeedItemCommentThread({
  variant,
  parentId,
  commentsCount,
  sessionId,
  accent,
  onCommentsCountChange,
}: {
  variant: "review" | "recommendation" | "feed_post";
  parentId: string;
  commentsCount: number;
  sessionId: string | null;
  accent: string;
  onCommentsCountChange: (next: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [comments, setComments] = useState<FeedCommentRow[]>([]);
  const [draft, setDraft] = useState("");
  const [commentImgs, setCommentImgs] = useState<PickedImage[]>([]);
  const [posting, setPosting] = useState(false);

  const listUrl =
    variant === "review"
      ? `/api/reviews/${parentId}/comments`
      : variant === "recommendation"
        ? `/api/book-recommendations/${parentId}/comments`
        : `/api/feed-posts/${parentId}/comments`;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    void fetch(listUrl)
      .then((r) => r.json())
      .then((d: { comments?: FeedCommentRow[] }) => {
        if (!cancelled) setComments(d.comments ?? []);
      })
      .catch(() => {
        if (!cancelled) setComments([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, listUrl]);

  async function voteOnComment(commentId: string, value: 1 | -1 | 0) {
    if (!sessionId) return;
    const url =
      variant === "review"
        ? `/api/review-comments/${commentId}/vote`
        : variant === "recommendation"
          ? `/api/book-rec-comments/${commentId}/vote`
          : `/api/feed-post-comments/${commentId}/vote`;
    const res = await fetch(url, {
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

  async function postComment() {
    if (!sessionId) return;
    if (!draft.trim() && commentImgs.length === 0) return;
    setPosting(true);
    try {
      const res = await fetch(listUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: draft,
          attachments: commentImgs.map((x) => ({ url: x.url, caption: x.caption || undefined })),
        }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as { comment: FeedCommentRow };
      setComments((prev) => [...prev, data.comment]);
      setDraft("");
      setCommentImgs([]);
      onCommentsCountChange(commentsCount + 1);
    } finally {
      setPosting(false);
    }
  }

  return (
    <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          fontSize: 12,
          color: accent,
          background: "none",
          border: "none",
          cursor: "pointer",
          fontWeight: 600,
          padding: 0,
        }}
      >
        Comments ({commentsCount})
      </button>
      {open && (
        <div style={{ marginTop: 10 }}>
          {loading ? (
            <p style={{ fontSize: 13, color: "var(--muted)" }}>Loading…</p>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
              {comments.map((c) => {
                const cv = c.votes?.[0]?.value ?? 0;
                const cname = c.user.displayName ?? c.user.username;
                return (
                  <li key={c.id} style={{ fontSize: 13, padding: 10, borderRadius: 8, background: "var(--bg)" }}>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>
                      <Link href={`/u/${encodeURIComponent(c.user.username)}`} style={{ color: "var(--text)", textDecoration: "none" }}>
                        {cname}
                      </Link>
                    </div>
                    {c.body.trim() ? (
                      <p style={{ margin: 0, color: "var(--text)", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{c.body}</p>
                    ) : null}
                    {(c.attachments?.length ?? 0) > 0 ? <AttachmentStrip attachments={c.attachments} size={44} /> : null}
                    <div style={{ marginTop: 8 }}>
                      <VoteRow
                        up={c.upvotesCount}
                        down={c.downvotesCount}
                        myVote={cv}
                        onVote={(v) => void voteOnComment(c.id, v)}
                        disabled={!sessionId}
                        accent={accent}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {sessionId && (
            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
              <div onClick={(e) => e.stopPropagation()}>
                <ImageAttachmentPicker items={commentImgs} onChange={setCommentImgs} max={6} label="Images" showCaptions={false} />
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
                disabled={posting}
                onClick={() => void postComment()}
                style={{
                  alignSelf: "flex-start",
                  padding: "8px 14px",
                  borderRadius: 8,
                  border: "none",
                  background: accent,
                  color: "#fff",
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: posting ? "not-allowed" : "pointer",
                  opacity: posting ? 0.7 : 1,
                }}
              >
                {posting ? "Posting…" : "Post comment"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FeedPostHero({ attachments }: { attachments: AttMini[] }) {
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);
  if (attachments.length === 0) return null;
  const carousel: CarouselImage[] = attachments.map((a) => ({ url: a.url, caption: a.caption ?? undefined }));
  const first = attachments[0];
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setIdx(0);
          setOpen(true);
        }}
        style={{
          position: "relative",
          width: "100%",
          maxHeight: 420,
          aspectRatio: "16 / 9",
          borderRadius: 12,
          overflow: "hidden",
          border: "none",
          padding: 0,
          cursor: "pointer",
          background: "var(--border)",
          marginBottom: 10,
        }}
      >
        <Image src={first.url} alt="" fill sizes="(max-width: 768px) 100vw, 640px" style={{ objectFit: "cover" }} />
      </button>
      {attachments.length > 1 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          {attachments.map((a, i) => (
            <button
              key={a.id}
              type="button"
              onClick={() => {
                setIdx(i);
                setOpen(true);
              }}
              style={{
                position: "relative",
                width: 52,
                height: 52,
                borderRadius: 8,
                overflow: "hidden",
                border: i === 0 ? "2px solid var(--accent)" : "1px solid var(--border)",
                padding: 0,
                cursor: "pointer",
              }}
            >
              <Image src={a.url} alt="" fill sizes="52px" style={{ objectFit: "cover" }} />
            </button>
          ))}
        </div>
      )}
      <ImageCarouselLightbox open={open} images={carousel} index={idx} onClose={() => setOpen(false)} onIndexChange={setIdx} />
    </>
  );
}

type FeedScope = "following" | "all";

export default function FeedClient() {
  const { data: session } = useSession();
  const { settings } = useTheme();
  const accent = settings.accentColour;
  const sessionId = session?.user?.id ?? null;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const feedScope: FeedScope =
    sessionId && searchParams.get("view") !== "all" ? "following" : "all";

  const [sort, setSort] = useState<Sort>("new");
  const [items, setItems] = useState<FeedItem[]>([]);
  const [followingCount, setFollowingCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [composerHtml, setComposerHtml] = useState("<p></p>");
  const [composerImgs, setComposerImgs] = useState<PickedImage[]>([]);
  const [posting, setPosting] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);

  const patchItemCommentsCount = useCallback((kind: FeedItem["kind"], id: string, nextCount: number) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id || it.kind !== kind) return it;
        if (it.kind === "review") return { ...it, review: { ...it.review, commentsCount: nextCount } };
        if (it.kind === "recommendation") return { ...it, recommendation: { ...it.recommendation, commentsCount: nextCount } };
        return { ...it, feedPost: { ...it.feedPost, commentsCount: nextCount } };
      }),
    );
  }, []);

  const setFeedScope = useCallback(
    (next: FeedScope) => {
      if (!sessionId) return;
      const p = new URLSearchParams(searchParams.toString());
      if (next === "all") p.set("view", "all");
      else p.delete("view");
      const q = p.toString();
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    },
    [sessionId, searchParams, pathname, router],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const scope = feedScope === "following" ? "following" : "all";
      const res = await fetch(`/api/feed?sort=${sort}&scope=${scope}`);
      const text = await res.text();
      if (feedScope === "following" && res.status === 401) {
        setItems([]);
        setFollowingCount(null);
        return;
      }
      const d = parseJsonBody<{ items?: FeedItem[]; followingCount?: number }>(text);
      if (d == null || !res.ok) {
        setItems([]);
        setFollowingCount(null);
        return;
      }
      setItems(d.items ?? []);
      setFollowingCount(typeof d.followingCount === "number" ? d.followingCount : null);
    } finally {
      setLoading(false);
    }
  }, [sort, feedScope]);

  useEffect(() => {
    void load();
  }, [load]);

  async function voteItem(item: FeedItem, value: 1 | -1 | 0) {
    if (!sessionId) return;
    const url =
      item.kind === "review"
        ? `/api/reviews/${item.id}/vote`
        : item.kind === "recommendation"
          ? `/api/book-recommendations/${item.id}/vote`
          : `/api/feed-posts/${item.id}/vote`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value }),
    });
    if (!res.ok) return;
    const d = (await res.json()) as { upvotesCount: number; downvotesCount: number; myVote: number };
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== item.id || it.kind !== item.kind) return it;
        const score = d.upvotesCount - d.downvotesCount;
        if (it.kind === "review") {
          return {
            ...it,
            myVote: d.myVote,
            score,
            review: { ...it.review, upvotesCount: d.upvotesCount, downvotesCount: d.downvotesCount },
          };
        }
        if (it.kind === "recommendation") {
          return {
            ...it,
            myVote: d.myVote,
            score,
            recommendation: {
              ...it.recommendation,
              upvotesCount: d.upvotesCount,
              downvotesCount: d.downvotesCount,
            },
          };
        }
        return {
          ...it,
          myVote: d.myVote,
          score,
          feedPost: { ...it.feedPost, upvotesCount: d.upvotesCount, downvotesCount: d.downvotesCount },
        };
      }),
    );
  }

  async function publishPost() {
    if (!sessionId) return;
    const plain = richTextToPlain(composerHtml);
    if (plain.length < 2 && composerImgs.length === 0) return;
    setPosting(true);
    try {
      const res = await fetch("/api/feed-posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: composerHtml,
          attachments: composerImgs.map((x) => ({ url: x.url, caption: x.caption || undefined })),
        }),
      });
      if (!res.ok) {
        const e = (await res.json().catch(() => ({}))) as { error?: string };
        alert(e.error ?? "Could not publish");
        return;
      }
      setComposerHtml("<p></p>");
      setComposerImgs([]);
      setComposerOpen(false);
      await load();
    } finally {
      setPosting(false);
    }
  }

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "32px clamp(14px, 4vw, 20px) 80px", width: "100%", boxSizing: "border-box", minWidth: 0 }}>
      <h1 style={{ fontSize: "clamp(22px, 5.5vw, 26px)", fontWeight: 800, margin: "0 0 8px", letterSpacing: "-0.5px" }}>
        {feedScope === "following" ? "Home" : "Discover"}
      </h1>
      <p style={{ fontSize: 14, color: "var(--muted)", marginBottom: 20, lineHeight: 1.5 }}>
        {feedScope === "following"
          ? "Reviews, recommendations, and posts from people you follow (and you)."
          : "The whole community — reviews, recommendations, and posts from everyone."}
      </p>

      {sessionId && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
          <button
            type="button"
            style={tabStyle(feedScope === "following", accent)}
            onClick={() => setFeedScope("following")}
          >
            Following
          </button>
          <button type="button" style={tabStyle(feedScope === "all", accent)} onClick={() => setFeedScope("all")}>
            Discover
          </button>
        </div>
      )}

      {sessionId && (
        <section
          style={{
            marginBottom: 28,
            borderRadius: 14,
            border: `1px solid var(--border)`,
            background: "var(--surface)",
            overflow: "hidden",
          }}
        >
          {!composerOpen ? (
            <button
              type="button"
              onClick={() => setComposerOpen(true)}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "14px 18px",
                border: "none",
                background: "transparent",
                cursor: "pointer",
                fontSize: 14,
                color: "var(--muted)",
              }}
            >
              <span style={{ fontWeight: 600, color: "var(--text)" }}>New post</span>
              <span style={{ marginLeft: 8 }}>— Click to write…</span>
            </button>
          ) : (
            <div style={{ padding: 18 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, gap: 12 }}>
                <p style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>New post</p>
                <button
                  type="button"
                  onClick={() => setComposerOpen(false)}
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--muted)",
                    background: "var(--bg)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    padding: "6px 12px",
                    cursor: "pointer",
                  }}
                >
                  Collapse
                </button>
              </div>
              <RichTextEditor value={composerHtml} onChange={setComposerHtml} placeholder="What’s on your mind?" minHeight={120} />
              <div style={{ marginTop: 12 }}>
                <ImageAttachmentPicker items={composerImgs} onChange={setComposerImgs} max={12} label="Photos (shown large on the feed)" />
              </div>
              <button
                type="button"
                disabled={posting}
                onClick={() => void publishPost()}
                style={{
                  marginTop: 14,
                  padding: "10px 20px",
                  borderRadius: 10,
                  border: "none",
                  background: accent,
                  color: "#fff",
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: posting ? "not-allowed" : "pointer",
                  opacity: posting ? 0.7 : 1,
                }}
              >
                {posting ? "Publishing…" : "Publish to feed"}
              </button>
            </div>
          )}
        </section>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 24 }}>
        {(["new", "top", "trending"] as const).map((s) => (
          <button key={s} type="button" style={tabStyle(sort === s, accent)} onClick={() => setSort(s)}>
            {s === "new" ? "New" : s === "top" ? "Top" : "Trending"}
          </button>
        ))}
      </div>

      {loading ? (
        <p style={{ color: "var(--muted)", fontSize: 14 }}>Loading…</p>
      ) : items.length === 0 ? (
        <div style={{ color: "var(--muted)", fontSize: 14, lineHeight: 1.6 }}>
          {feedScope === "following" && sessionId ? (
            <>
              <p style={{ margin: "0 0 12px" }}>No activity from your network yet.</p>
              {(followingCount === 0 || followingCount === null) && (
                <p style={{ margin: "0 0 12px" }}>
                  Follow readers from{" "}
                  <Link href="/search" style={{ color: accent, fontWeight: 600 }}>
                    Search
                  </Link>{" "}
                  (People tab) to see their reviews and posts here.
                </p>
              )}
              <p style={{ margin: 0 }}>
                Or browse{" "}
                <button
                  type="button"
                  onClick={() => setFeedScope("all")}
                  style={{
                    background: "none",
                    border: "none",
                    padding: 0,
                    color: accent,
                    fontWeight: 600,
                    cursor: "pointer",
                    fontSize: "inherit",
                    textDecoration: "underline",
                  }}
                >
                  Discover
                </button>{" "}
                for the full community feed.
              </p>
            </>
          ) : (
            <p style={{ margin: 0 }}>Nothing here yet.</p>
          )}
        </div>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 16 }}>
          {items.map((item) => (
            <li
              key={`${item.kind}-${item.id}`}
              style={{
                borderRadius: 14,
                border: "1px solid var(--border)",
                background: "var(--surface)",
                padding: 18,
              }}
            >
              {item.kind === "review" && (
                <FeedReviewCard
                  item={item}
                  sessionId={sessionId}
                  accent={accent}
                  onVote={(v) => void voteItem(item, v)}
                  onCommentsCountChange={(n) => patchItemCommentsCount("review", item.id, n)}
                />
              )}
              {item.kind === "recommendation" && (
                <FeedRecCard
                  item={item}
                  sessionId={sessionId}
                  accent={accent}
                  onVote={(v) => void voteItem(item, v)}
                  onCommentsCountChange={(n) => patchItemCommentsCount("recommendation", item.id, n)}
                />
              )}
              {item.kind === "feed_post" && (
                <FeedPostCard
                  item={item}
                  sessionId={sessionId}
                  accent={accent}
                  onVote={(v) => void voteItem(item, v)}
                  onCommentsCountChange={(n) => patchItemCommentsCount("feed_post", item.id, n)}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FeedReviewCard({
  item,
  sessionId,
  accent,
  onVote,
  onCommentsCountChange,
}: {
  item: Extract<FeedItem, { kind: "review" }>;
  sessionId: string | null;
  accent: string;
  onVote: (v: 1 | -1 | 0) => void;
  onCommentsCountChange: (n: number) => void;
}) {
  const { review } = item;
  const name = review.user.displayName ?? review.user.username;
  const plain = excerpt(review.body);
  return (
    <>
      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.04em" }}>
        Review
      </div>
      <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
        <Link href={`/books/${review.work.id}`} style={{ flexShrink: 0 }}>
          <div style={{ width: 52, height: 78, borderRadius: 8, overflow: "hidden", background: "var(--border)", position: "relative" }}>
            {review.work.coverUrl ? (
              <Image src={review.work.coverUrl} alt="" fill style={{ objectFit: "cover" }} sizes="52px" />
            ) : (
              <span style={{ fontSize: 10, padding: 6, color: "var(--muted)", display: "block" }}>{review.work.title.slice(0, 14)}</span>
            )}
          </div>
        </Link>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Link href={`/books/${review.work.id}`} style={{ fontWeight: 700, fontSize: 16, color: "var(--text)", textDecoration: "none" }}>
            {review.work.title}
          </Link>
          <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
            <Link href={`/u/${encodeURIComponent(review.user.username)}`} style={{ color: "var(--text)", fontWeight: 600, textDecoration: "none" }}>
              {name}
            </Link>
            {review.rating != null ? (
              <span style={{ marginLeft: 8, display: "inline-flex", verticalAlign: "middle" }}>
                <HalfStarRatingDisplay rating={Number(review.rating)} fontSize={14} />
              </span>
            ) : null}
          </div>
          {review.containsSpoilers ? (
            <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 10, marginBottom: 0 }}>Contains spoilers — open the book page to read.</p>
          ) : (
            <p style={{ fontSize: 14, color: "var(--text)", lineHeight: 1.55, marginTop: 10, marginBottom: 0 }}>{plain || "—"}</p>
          )}
          <AttachmentStrip attachments={review.attachments ?? []} />
          <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
            <VoteRow
              up={review.upvotesCount}
              down={review.downvotesCount}
              myVote={item.myVote}
              onVote={onVote}
              disabled={!sessionId}
              accent={accent}
            />
            <span style={{ fontSize: 12, color: "var(--muted)" }}>
              {new Date(item.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
              {" · "}
              <Link href={`/books/${review.work.id}`} style={{ color: accent, fontWeight: 600 }}>
                View book
              </Link>
            </span>
          </div>
          <FeedItemCommentThread
            variant="review"
            parentId={review.id}
            commentsCount={review.commentsCount ?? 0}
            sessionId={sessionId}
            accent={accent}
            onCommentsCountChange={onCommentsCountChange}
          />
        </div>
      </div>
    </>
  );
}

function FeedRecCard({
  item,
  sessionId,
  accent,
  onVote,
  onCommentsCountChange,
}: {
  item: Extract<FeedItem, { kind: "recommendation" }>;
  sessionId: string | null;
  accent: string;
  onVote: (v: 1 | -1 | 0) => void;
  onCommentsCountChange: (n: number) => void;
}) {
  const { recommendation: rec } = item;
  const name = rec.user.displayName ?? rec.user.username;
  const plain = excerpt(rec.body);
  return (
    <>
      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.04em" }}>
        Recommendation
      </div>
      <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
        <Link href={`/books/${rec.work.id}`} style={{ flexShrink: 0 }}>
          <div style={{ width: 52, height: 78, borderRadius: 8, overflow: "hidden", background: "var(--border)", position: "relative" }}>
            {rec.work.coverUrl ? (
              <Image src={rec.work.coverUrl} alt="" fill style={{ objectFit: "cover" }} sizes="52px" />
            ) : (
              <span style={{ fontSize: 10, padding: 6, color: "var(--muted)", display: "block" }}>{rec.work.title.slice(0, 14)}</span>
            )}
          </div>
        </Link>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, lineHeight: 1.4 }}>
            <Link href={`/u/${encodeURIComponent(rec.user.username)}`} style={{ fontWeight: 700, color: "var(--text)", textDecoration: "none" }}>
              {name}
            </Link>
            <span style={{ color: "var(--muted)", fontWeight: 500 }}> recommends </span>
            <Link href={`/books/${rec.work.id}`} style={{ fontWeight: 700, color: accent, textDecoration: "none" }}>
              {rec.work.title}
            </Link>
            {rec.contextWork ? (
              <span style={{ color: "var(--muted)", fontWeight: 500 }}>
                {" "}
                (after <Link href={`/books/${rec.contextWork.id}`}>{rec.contextWork.title}</Link>)
              </span>
            ) : null}
          </div>
          <p style={{ fontSize: 14, color: "var(--text)", lineHeight: 1.55, marginTop: 10, marginBottom: 0 }}>{plain || "—"}</p>
          <AttachmentStrip attachments={rec.attachments ?? []} />
          <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
            <VoteRow
              up={rec.upvotesCount}
              down={rec.downvotesCount}
              myVote={item.myVote}
              onVote={onVote}
              disabled={!sessionId}
              accent={accent}
            />
            <span style={{ fontSize: 12, color: "var(--muted)" }}>
              {new Date(item.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
              {" · "}
              <Link href={`/books/${rec.work.id}`} style={{ color: accent, fontWeight: 600 }}>
                View book
              </Link>
            </span>
          </div>
          <FeedItemCommentThread
            variant="recommendation"
            parentId={rec.id}
            commentsCount={rec.commentsCount ?? 0}
            sessionId={sessionId}
            accent={accent}
            onCommentsCountChange={onCommentsCountChange}
          />
        </div>
      </div>
    </>
  );
}

function FeedPostCard({
  item,
  sessionId,
  accent,
  onVote,
  onCommentsCountChange,
}: {
  item: Extract<FeedItem, { kind: "feed_post" }>;
  sessionId: string | null;
  accent: string;
  onVote: (v: 1 | -1 | 0) => void;
  onCommentsCountChange: (n: number) => void;
}) {
  const { feedPost: p } = item;
  const name = p.user.displayName ?? p.user.username;
  return (
    <>
      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.04em" }}>
        Post
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            background: accent,
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 14,
            fontWeight: 700,
          }}
        >
          {name.charAt(0).toUpperCase()}
        </div>
        <Link href={`/u/${encodeURIComponent(p.user.username)}`} style={{ fontWeight: 700, fontSize: 15, color: "var(--text)", textDecoration: "none" }}>
          {name}
        </Link>
        <span style={{ fontSize: 12, color: "var(--muted)", marginLeft: "auto" }}>
          {new Date(item.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
        </span>
      </div>
      {p.readingLog ? (
        <div
          className="feed-reading-log-card"
          style={{
            marginBottom: 12,
            display: "flex",
            flexWrap: "wrap",
            gap: 14,
            padding: 14,
            borderRadius: 12,
            border: "1px solid var(--border)",
            background: "var(--bg)",
            color: "var(--text)",
          }}
        >
          <div
            className="feed-reading-cover"
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
            {p.readingLog.work.coverUrl ? (
              <Image src={p.readingLog.work.coverUrl} alt="" fill sizes="56px" style={{ objectFit: "cover" }} />
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
                {p.readingLog.work.title.slice(0, 28)}
                {p.readingLog.work.title.length > 28 ? "…" : ""}
              </div>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0, fontSize: 13, lineHeight: 1.45 }}>
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
              Reading log
            </div>
            <Link href={`/books/${p.readingLog.work.id}`} style={{ fontWeight: 700, fontSize: 15, color: "var(--text)", textDecoration: "none", display: "block", lineHeight: 1.35 }}>
              {p.readingLog.work.title}
            </Link>
            <div
              className="feed-reading-meta"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: "10px 14px",
                marginTop: 12,
                fontSize: 12,
              }}
            >
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.03em" }}>Period</div>
                <div style={{ fontWeight: 600, color: "var(--text)", marginTop: 2 }}>
                  {p.readingLog.periodEnd
                    ? `${fmtReadingDay(p.readingLog.periodStart)} – ${fmtReadingDay(p.readingLog.periodEnd)}`
                    : `From ${fmtReadingDay(p.readingLog.periodStart)}`}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.03em" }}>Pages</div>
                <div style={{ fontWeight: 600, color: "var(--text)", marginTop: 2 }}>
                  {p.readingLog.pagesRead > 0 ? `${p.readingLog.pagesRead} read` : "—"}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.03em" }}>Time</div>
                <div style={{ fontWeight: 600, color: "var(--text)", marginTop: 2 }}>
                  {p.readingLog.readingTimeMinutes != null && p.readingLog.readingTimeMinutes > 0
                    ? `${p.readingLog.readingTimeMinutes} min total`
                    : "—"}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.03em" }}>Progress</div>
                <div style={{ fontWeight: 600, color: "var(--text)", marginTop: 2 }}>
                  {p.readingLog.progressPercent != null && Number.isFinite(p.readingLog.progressPercent)
                    ? `${Math.round(p.readingLog.progressPercent * 10) / 10}%`
                    : "—"}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.03em" }}>Format</div>
                <div style={{ fontWeight: 600, color: "var(--text)", marginTop: 2 }}>{fmtReadingMedium(p.readingLog.medium)}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.03em" }}>Read</div>
                <div style={{ fontWeight: 600, color: "var(--text)", marginTop: 2 }}>#{p.readingLog.readCycle}</div>
              </div>
            </div>
            {sessionId && p.user.id === sessionId ? (
              <div style={{ marginTop: 10 }}>
                <Link href={`/reading/session/${p.readingLog.sessionId}`} style={{ color: accent, fontWeight: 600, textDecoration: "none", fontSize: 12 }}>
                  Edit this log
                </Link>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
      <FeedPostHero attachments={p.attachments ?? []} />
      {p.body?.trim() ? (
        <div style={{ fontSize: 15, color: "var(--text)", lineHeight: 1.6 }}>
          <SafeRichHtml html={p.body} />
        </div>
      ) : null}
      <div style={{ marginTop: 12 }}>
        <VoteRow
          up={p.upvotesCount}
          down={p.downvotesCount}
          myVote={item.myVote}
          onVote={onVote}
          disabled={!sessionId}
          accent={accent}
        />
      </div>
      <FeedItemCommentThread
        variant="feed_post"
        parentId={p.id}
        commentsCount={p.commentsCount ?? 0}
        sessionId={sessionId}
        accent={accent}
        onCommentsCountChange={onCommentsCountChange}
      />
    </>
  );
}
