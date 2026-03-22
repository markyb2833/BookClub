"use client";

import RichTextEditor from "@/components/editor/RichTextEditor";
import ImageAttachmentPicker, { type PickedImage } from "@/components/media/ImageAttachmentPicker";
import { useTheme } from "@/components/ThemeProvider";
import { localCalendarDateString } from "@/lib/reading/readingSessionInput";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

const MEDIUMS = ["paperback", "hardcover", "ebook", "audiobook", "other"] as const;

type HighlightRow = { text: string; page: string; note: string };

export type ReadingPrefillWork = {
  id: string;
  title: string;
  coverUrl?: string | null;
  editionId?: string | null;
};

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
  work: { id: string; title: string; coverUrl: string | null };
};

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: "var(--muted)",
          textTransform: "uppercase",
          letterSpacing: "0.03em",
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginTop: 2 }}>{value}</div>
    </div>
  );
}

function formatMediumLabel(m: string) {
  return m.replace(/_/g, " ").replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function formatPeriodPreview(start: string, end: string) {
  if (!start.trim()) return "—";
  const fmt = (iso: string) => {
    const [y, mo, d] = iso.split("-").map(Number);
    if (!y || !mo || !d) return iso;
    return new Date(y, mo - 1, d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  };
  const a = fmt(start);
  if (!end.trim()) return `From ${a}`;
  if (start === end) return a;
  return `${a} – ${fmt(end)}`;
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        borderRadius: 14,
        border: "1px solid var(--border)",
        background: "var(--surface)",
        padding: "16px 18px",
        width: "100%",
        boxSizing: "border-box",
        minWidth: 0,
      }}
    >
      <div style={{ marginBottom: 14 }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--text)" }}>{title}</h3>
        {hint ? (
          <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>{hint}</p>
        ) : null}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>{children}</div>
    </div>
  );
}

export default function ReadingSessionForm({
  mode,
  sessionId,
  initial,
  prefillWork,
  onSaved,
}: {
  mode: "create" | "edit";
  sessionId?: string;
  initial?: SessionDto | null;
  /** When set (create mode), selects this work and shows a quick-pick card. */
  prefillWork?: ReadingPrefillWork | null;
  onSaved: (payload?: { id: string; workId?: string; workTitle?: string }) => void;
}) {
  const { settings } = useTheme();
  const accent = settings.accentColour;

  const [workQuery, setWorkQuery] = useState("");
  const [workHits, setWorkHits] = useState<{ id: string; title: string }[]>([]);
  const [workId, setWorkId] = useState(() => initial?.workId ?? prefillWork?.id ?? "");
  const [workTitle, setWorkTitle] = useState(() => initial?.work?.title ?? prefillWork?.title ?? "");
  const [editionId, setEditionId] = useState<string | null>(() => initial?.editionId ?? prefillWork?.editionId ?? null);
  const [showBookSearch, setShowBookSearch] = useState(() => mode === "create" && !prefillWork?.id);

  const [periodStart, setPeriodStart] = useState(() => initial?.periodStart ?? (mode === "create" ? localCalendarDateString() : ""));
  const [periodEnd, setPeriodEnd] = useState(() =>
    initial?.periodEnd != null && initial.periodEnd !== "" ? initial.periodEnd : mode === "create" ? localCalendarDateString() : "",
  );
  const [date, setDate] = useState(() => initial?.date ?? (mode === "create" ? localCalendarDateString() : ""));
  const [pagesRead, setPagesRead] = useState(String(initial?.pagesRead ?? 0));
  const [pagesTotal, setPagesTotal] = useState(initial?.pagesTotal != null ? String(initial.pagesTotal) : "");
  const [startPage, setStartPage] = useState(initial?.startPage != null ? String(initial.startPage) : "");
  const [endPage, setEndPage] = useState(initial?.endPage != null ? String(initial.endPage) : "");
  const [pct, setPct] = useState(initial?.percentComplete != null ? String(initial.percentComplete) : "");
  const [rtMin, setRtMin] = useState(initial?.readingTimeMinutes != null ? String(initial.readingTimeMinutes) : "");
  const [medium, setMedium] = useState<string>(initial?.medium ?? "paperback");
  const [mediumNote, setMediumNote] = useState(initial?.mediumNote ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [highlights, setHighlights] = useState<HighlightRow[]>(() => {
    if (!initial?.highlights || !Array.isArray(initial.highlights)) return [];
    return (initial.highlights as { text?: string; page?: number; note?: string }[]).map((h) => ({
      text: h.text ?? "",
      page: h.page != null ? String(h.page) : "",
      note: h.note ?? "",
    }));
  });

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [shareToFeed, setShareToFeed] = useState(false);
  const [feedHtml, setFeedHtml] = useState("<p></p>");
  const [feedImgs, setFeedImgs] = useState<PickedImage[]>([]);
  const [pickedCoverUrl, setPickedCoverUrl] = useState<string | null>(() => prefillWork?.coverUrl ?? null);

  useEffect(() => {
    if (mode !== "create" || !prefillWork?.id) return;
    setWorkId(prefillWork.id);
    setWorkTitle(prefillWork.title);
    setEditionId(prefillWork.editionId ?? null);
    setWorkQuery("");
    setWorkHits([]);
    setShowBookSearch(false);
  }, [mode, prefillWork?.id, prefillWork?.editionId, prefillWork?.title]);

  useEffect(() => {
    if (mode === "edit" && initial) {
      setWorkId(initial.workId);
      setWorkTitle(initial.work.title);
      setEditionId(initial.editionId);
      setPeriodStart(initial.periodStart);
      setPeriodEnd(initial.periodEnd ?? "");
      setDate(initial.date);
      setPagesRead(String(initial.pagesRead));
      setPagesTotal(initial.pagesTotal != null ? String(initial.pagesTotal) : "");
      setStartPage(initial.startPage != null ? String(initial.startPage) : "");
      setEndPage(initial.endPage != null ? String(initial.endPage) : "");
      setPct(initial.percentComplete != null ? String(initial.percentComplete) : "");
      setRtMin(initial.readingTimeMinutes != null ? String(initial.readingTimeMinutes) : "");
      setMedium(initial.medium);
      setMediumNote(initial.mediumNote ?? "");
      setNotes(initial.notes ?? "");
      if (!initial.highlights || !Array.isArray(initial.highlights)) {
        setHighlights([]);
      } else {
        setHighlights(
          (initial.highlights as { text?: string; page?: number; note?: string }[]).map((h) => ({
            text: h.text ?? "",
            page: h.page != null ? String(h.page) : "",
            note: h.note ?? "",
          })),
        );
      }
    }
  }, [mode, initial]);

  const searchWorks = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setWorkHits([]);
      return;
    }
    const res = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`);
    const d = (await res.json()) as { hits?: { id: string; title: string }[] };
    setWorkHits(d.hits?.slice(0, 12) ?? []);
  }, []);

  useEffect(() => {
    if (mode !== "create") return;
    const t = setTimeout(() => void searchWorks(workQuery), 280);
    return () => clearTimeout(t);
  }, [workQuery, mode, searchWorks]);

  useEffect(() => {
    if (mode !== "create") return;
    if (!workId) {
      setPickedCoverUrl(null);
      return;
    }
    if (prefillWork?.id === workId && prefillWork.coverUrl) {
      setPickedCoverUrl(prefillWork.coverUrl);
      return;
    }
    let cancelled = false;
    void fetch(`/api/books/${workId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((w: { coverUrl?: string | null } | null) => {
        if (!cancelled) setPickedCoverUrl(w?.coverUrl ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [mode, workId, prefillWork?.id, prefillWork?.coverUrl]);

  useEffect(() => {
    if (mode !== "create" || !workId) return;
    let cancelled = false;
    void fetch(`/api/reading/sessions?workId=${encodeURIComponent(workId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { sessions?: { pagesTotal: number | null; endPage: number | null }[] } | null) => {
        if (cancelled || !d?.sessions?.length) return;
        const s = d.sessions[0];
        if (s.pagesTotal != null) setPagesTotal(String(s.pagesTotal));
        if (s.endPage != null) setStartPage(String(s.endPage + 1));
      });
    return () => {
      cancelled = true;
    };
  }, [mode, workId]);

  useEffect(() => {
    if (mode !== "create") return;
    const total = parseInt(pagesTotal.trim(), 10);
    const end = parseInt(endPage.trim(), 10);
    if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(end) || end < 0) return;
    const clamped = Math.min(100, Math.max(0, (end / total) * 100));
    const rounded = Math.round(clamped * 10) / 10;
    setPct(String(rounded));
  }, [mode, pagesTotal, endPage]);

  useEffect(() => {
    if (mode !== "create") return;
    const start = parseInt(startPage.trim(), 10);
    const end = parseInt(endPage.trim(), 10);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return;
    setPagesRead(String(end - start + 1));
  }, [mode, startPage, endPage]);

  function addHighlight() {
    setHighlights((h) => [...h, { text: "", page: "", note: "" }]);
  }

  function buildPayload() {
    const hlOut = highlights
      .filter((h) => h.text.trim())
      .map((h) => ({
        text: h.text.trim(),
        ...(h.page.trim() ? { page: parseInt(h.page, 10) } : {}),
        ...(h.note.trim() ? { note: h.note.trim() } : {}),
      }));
    const pr = parseInt(pagesRead, 10);
    const payload: Record<string, unknown> = {
      ...(mode === "create" ? { workId } : {}),
      periodStart,
      periodEnd: periodEnd.trim() === "" ? null : periodEnd,
      date: date.trim() === "" ? undefined : date,
      pagesRead: Number.isFinite(pr) ? pr : 0,
      pagesTotal: pagesTotal.trim() === "" ? null : parseInt(pagesTotal, 10),
      startPage: startPage.trim() === "" ? null : parseInt(startPage, 10),
      endPage: endPage.trim() === "" ? null : parseInt(endPage, 10),
      percentComplete: pct.trim() === "" ? null : parseFloat(pct),
      readingTimeMinutes: rtMin.trim() === "" ? null : parseInt(rtMin, 10),
      medium,
      mediumNote: mediumNote.trim() === "" ? null : mediumNote.trim(),
      notes: notes.trim() === "" ? null : notes.trim(),
      ...(mode === "edit" ? { highlights: hlOut.length ? hlOut : null } : hlOut.length ? { highlights: hlOut } : {}),
    };
    if (mode === "create" && editionId && /^[0-9a-f-]{36}$/i.test(editionId)) {
      payload.editionId = editionId;
    }
    return payload;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (mode === "create" && !workId) {
      setErr("Choose a book.");
      return;
    }
    if (!periodStart.trim()) {
      setErr("Start date is required.");
      return;
    }
    setSaving(true);
    try {
      const payload = buildPayload();
      const url = mode === "create" ? "/api/reading/sessions" : `/api/reading/sessions/${sessionId}`;
      const res = await fetch(url, {
        method: mode === "create" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = (await res.json().catch(() => ({}))) as {
        error?: unknown;
        session?: { id: string; workId: string; work?: { title: string } };
      };
      if (!res.ok) {
        setErr(typeof d.error === "string" ? d.error : "Could not save");
        return;
      }
      if (mode === "create" && d.session?.id) {
        const sid = d.session.id;
        if (shareToFeed) {
          const fp = await fetch(`/api/reading/sessions/${sid}/feed-post`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              body: feedHtml,
              attachments: feedImgs.map((x) => ({ url: x.url, caption: x.caption || undefined })),
            }),
          });
          if (!fp.ok) {
            const fe = (await fp.json().catch(() => ({}))) as { error?: string };
            window.alert(
              `Your read log was saved. We couldn’t post to the feed: ${fe.error ?? "unknown error"}. Open this log from the calendar to try again.`,
            );
          }
        }
        onSaved({
          id: sid,
          workId: d.session.workId,
          workTitle: d.session.work?.title,
        });
      } else onSaved();
    } finally {
      setSaving(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    boxSizing: "border-box",
    borderRadius: 10,
    border: "1px solid var(--border)",
    padding: "10px 12px",
    fontSize: 14,
    background: "var(--bg)",
    color: "var(--text)",
  };

  const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: "var(--muted)", marginBottom: 6, display: "block" };

  return (
    <form
      onSubmit={(e) => void submit(e)}
      style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 560, width: "100%", boxSizing: "border-box", minWidth: 0 }}
    >
      {err && (
        <div
          style={{
            padding: "12px 14px",
            borderRadius: 10,
            background: "rgba(185, 28, 28, 0.08)",
            border: "1px solid rgba(185, 28, 28, 0.25)",
            color: "#b91c1c",
            fontSize: 14,
          }}
        >
          {err}
        </div>
      )}

      <Section
        title={mode === "create" ? "Which book?" : "Book"}
        hint={mode === "create" ? "Pick from your reading list below or search the catalogue." : undefined}
      >
        {mode === "create" ? (
          <>
            {workId && !showBookSearch ? (
              <div
                style={{
                  display: "flex",
                  gap: 14,
                  alignItems: "center",
                  padding: 12,
                  borderRadius: 12,
                  border: `1px solid ${accent}33`,
                  background: `${accent}0d`,
                }}
              >
                <div style={{ width: 48, height: 72, borderRadius: 8, overflow: "hidden", background: "var(--border)", position: "relative", flexShrink: 0 }}>
                  {prefillWork?.id === workId && prefillWork.coverUrl ? (
                    <Image src={prefillWork.coverUrl} alt="" fill sizes="48px" style={{ objectFit: "cover" }} />
                  ) : (
                    <span style={{ fontSize: 10, padding: 6, color: "var(--muted)", display: "block" }}>{workTitle.slice(0, 12)}</span>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: 15, lineHeight: 1.35 }}>{workTitle}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setShowBookSearch(true);
                      setWorkId("");
                      setWorkTitle("");
                      setEditionId(null);
                      setPagesTotal("");
                      setStartPage("");
                      setEndPage("");
                      setPct("");
                      setPagesRead("0");
                    }}
                    style={{
                      marginTop: 8,
                      fontSize: 13,
                      fontWeight: 600,
                      color: accent,
                      background: "none",
                      border: "none",
                      padding: 0,
                      cursor: "pointer",
                      textDecoration: "underline",
                    }}
                  >
                    Change book
                  </button>
                </div>
              </div>
            ) : null}

            {(showBookSearch || !workId) && (
              <div>
                <label style={labelStyle}>Search</label>
                <input
                  value={workQuery}
                  onChange={(e) => setWorkQuery(e.target.value)}
                  placeholder="Type a title…"
                  style={inputStyle}
                />
                {workHits.length > 0 && (
                  <ul
                    style={{
                      listStyle: "none",
                      margin: "10px 0 0",
                      padding: 0,
                      border: "1px solid var(--border)",
                      borderRadius: 10,
                      maxHeight: 220,
                      overflowY: "auto",
                    }}
                  >
                    {workHits.map((h) => (
                      <li key={h.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setWorkId(h.id);
                            setWorkTitle(h.title);
                            setEditionId(null);
                            setWorkHits([]);
                            setWorkQuery("");
                            setShowBookSearch(false);
                          }}
                          style={{
                            display: "block",
                            width: "100%",
                            textAlign: "left",
                            padding: "10px 12px",
                            border: "none",
                            background: workId === h.id ? `${accent}18` : "transparent",
                            cursor: "pointer",
                            fontSize: 14,
                          }}
                        >
                          {h.title}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </>
        ) : (
          <>
            <p style={{ margin: 0, fontWeight: 700, fontSize: 16 }}>
              <Link href={`/books/${workId}`} style={{ color: accent, textDecoration: "none" }}>
                {workTitle}
              </Link>
            </p>
            {initial && (
              <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
                Read #{initial.readCycle}
              </p>
            )}
          </>
        )}
      </Section>

      <Section
        title="When"
        hint="Dates default to today; widen the range if this log covers several days. Clear “period end” if you’re still in the middle of this stretch."
      >
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }} className="reading-form-grid-2">
          <style>{`@media (max-width: 520px) { .reading-form-grid-2 { grid-template-columns: 1fr !important; } }`}</style>
          <div>
            <label style={labelStyle}>Period start</label>
            <input type="date" required value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Period end</label>
            <input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} style={inputStyle} />
          </div>
        </div>
        <div>
          <label style={labelStyle}>Streak / activity day</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inputStyle} />
          <span style={{ fontSize: 11, color: "var(--muted)", display: "block", marginTop: 6 }}>
            Counts toward reading streaks. Usually matches today or the day you read.
          </span>
        </div>
      </Section>

      <Section
        title="Progress"
        hint={
          mode === "create"
            ? "Choosing a book loads your last page total and suggests the next start page. Pages read fills from start & end page; % complete uses end ÷ book total."
            : "Rough numbers are fine — you can always fix this log later."
        }
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }} className="reading-form-grid-3">
          <style>{`@media (max-width: 520px) { .reading-form-grid-3 { grid-template-columns: 1fr !important; } }`}</style>
          <div>
            <label style={labelStyle}>Pages read</label>
            <input value={pagesRead} onChange={(e) => setPagesRead(e.target.value)} inputMode="numeric" style={inputStyle} />
            {mode === "create" ? (
              <span style={{ fontSize: 11, color: "var(--muted)", display: "block", marginTop: 6 }}>
                Set start &amp; end page to fill this automatically (end − start + 1).
              </span>
            ) : null}
          </div>
          <div>
            <label style={labelStyle}>Book page total</label>
            <input value={pagesTotal} onChange={(e) => setPagesTotal(e.target.value)} inputMode="numeric" placeholder="optional" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>% complete</label>
            <input value={pct} onChange={(e) => setPct(e.target.value)} placeholder={mode === "create" ? "auto" : "optional"} style={inputStyle} />
            {mode === "create" ? (
              <span style={{ fontSize: 11, color: "var(--muted)", display: "block", marginTop: 6 }}>Updates when book total and end page are both set.</span>
            ) : null}
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }} className="reading-form-grid-3">
          <div>
            <label style={labelStyle}>Start page</label>
            <input value={startPage} onChange={(e) => setStartPage(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>End page</label>
            <input value={endPage} onChange={(e) => setEndPage(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Reading time (min)</label>
            <input value={rtMin} onChange={(e) => setRtMin(e.target.value)} style={inputStyle} />
            <span style={{ fontSize: 11, color: "var(--muted)", display: "block", marginTop: 6, lineHeight: 1.45 }}>
              Total time for this log. Stats split it evenly across each calendar day from period start through period end (in range).
            </span>
          </div>
        </div>
      </Section>

      <Section title="Format" hint="Paper, audio, ebook — add a note for app or device if you like.">
        <div>
          <label style={labelStyle}>Medium</label>
          <select value={medium} onChange={(e) => setMedium(e.target.value)} style={inputStyle}>
            {MEDIUMS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Format note</label>
          <input value={mediumNote} onChange={(e) => setMediumNote(e.target.value)} style={inputStyle} placeholder="Kindle, Libby, hardback…" />
        </div>
      </Section>

      <Section title="Notes & highlights">
        <div>
          <label style={labelStyle}>Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} style={{ ...inputStyle, resize: "vertical" }} placeholder="Thoughts on this read…" />
        </div>
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <label style={{ ...labelStyle, marginBottom: 0 }}>Highlights</label>
            <button type="button" onClick={addHighlight} style={{ fontSize: 12, fontWeight: 600, color: accent, background: "none", border: "none", cursor: "pointer" }}>
              + Add passage
            </button>
          </div>
          {highlights.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>Optional quotes or memorable lines.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {highlights.map((h, i) => (
                <div key={i} style={{ padding: 12, borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg)" }}>
                  <textarea
                    value={h.text}
                    onChange={(e) => {
                      const next = [...highlights];
                      next[i] = { ...next[i], text: e.target.value };
                      setHighlights(next);
                    }}
                    placeholder="Highlight text"
                    rows={2}
                    style={{ ...inputStyle, marginBottom: 8 }}
                  />
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <input
                      value={h.page}
                      onChange={(e) => {
                        const next = [...highlights];
                        next[i] = { ...next[i], page: e.target.value };
                        setHighlights(next);
                      }}
                      placeholder="Page"
                      style={{ ...inputStyle, flex: "1 1 80px", minWidth: 72 }}
                    />
                    <input
                      value={h.note}
                      onChange={(e) => {
                        const next = [...highlights];
                        next[i] = { ...next[i], note: e.target.value };
                        setHighlights(next);
                      }}
                      placeholder="Your note"
                      style={{ ...inputStyle, flex: "3 1 120px", minWidth: 0 }}
                    />
                    <button
                      type="button"
                      onClick={() => setHighlights(highlights.filter((_, j) => j !== i))}
                      style={{ padding: "0 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", cursor: "pointer" }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Section>

      {mode === "create" && (
        <Section
          title="Share to feed"
          hint="Optional. Publishes a reading card on Discover; your reading notes and highlights from this log are included in the post body. An extra note and photos here are optional."
        >
          <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", fontSize: 14, fontWeight: 600 }}>
            <input
              type="checkbox"
              checked={shareToFeed}
              onChange={(e) => setShareToFeed(e.target.checked)}
              style={{ marginTop: 3, width: 18, height: 18, accentColor: accent }}
            />
            <span>Post to Discover when I save this log</span>
          </label>
          {shareToFeed ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <style>{`
                @media (max-width: 480px) {
                  .reading-share-preview { flex-direction: column !important; align-items: stretch !important; }
                  .reading-share-preview .reading-share-cover { align-self: center; }
                }
                @media (max-width: 380px) {
                  .reading-share-meta { grid-template-columns: 1fr !important; }
                }
              `}</style>
              <div
                className="reading-share-preview"
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 16,
                  padding: 14,
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                  background: "var(--bg)",
                  alignItems: "flex-start",
                }}
              >
                <div
                  className="reading-share-cover"
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
                  {pickedCoverUrl ? (
                    <Image src={pickedCoverUrl} alt="" fill sizes="56px" style={{ objectFit: "cover" }} />
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
                      {workTitle ? workTitle.slice(0, 24) + (workTitle.length > 24 ? "…" : "") : "Pick a book"}
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
                    Preview
                  </div>
                  <p style={{ margin: "0 0 12px", fontWeight: 700, fontSize: 15, lineHeight: 1.35, color: "var(--text)" }}>{workTitle || "—"}</p>
                  <div
                    className="reading-share-meta"
                    style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "10px 14px" }}
                  >
                    <StatCell label="Period" value={formatPeriodPreview(periodStart, periodEnd)} />
                    <StatCell
                      label="Pages"
                      value={(() => {
                        const n = parseInt(pagesRead, 10);
                        return Number.isFinite(n) && n > 0 ? `${n} read` : "—";
                      })()}
                    />
                    <StatCell
                      label="Time"
                      value={(() => {
                        const n = parseInt(rtMin.trim(), 10);
                        return Number.isFinite(n) && n > 0 ? `${n} min total` : "—";
                      })()}
                    />
                    <StatCell
                      label="Progress"
                      value={(() => {
                        const v = parseFloat(pct.trim());
                        if (!Number.isFinite(v)) return "—";
                        const c = Math.min(100, Math.max(0, v));
                        return `${c % 1 === 0 ? String(Math.round(c)) : c.toFixed(1)}%`;
                      })()}
                    />
                    <StatCell label="Format" value={formatMediumLabel(medium)} />
                    <StatCell label="Read #" value="New log" />
                  </div>
                </div>
              </div>
              <div>
                <label style={{ ...labelStyle, marginBottom: 8 }}>Optional note</label>
                <RichTextEditor value={feedHtml} onChange={setFeedHtml} placeholder="Thoughts, quotes, anything extra…" minHeight={100} />
              </div>
              <ImageAttachmentPicker items={feedImgs} onChange={setFeedImgs} max={12} label="Photos (optional)" />
            </div>
          ) : null}
        </Section>
      )}

      <button
        type="submit"
        disabled={saving}
        style={{
          width: "100%",
          maxWidth: "min(100%, 360px)",
          padding: "14px 22px",
          borderRadius: 12,
          border: "none",
          background: accent,
          color: "#fff",
          fontWeight: 700,
          fontSize: 15,
          cursor: saving ? "not-allowed" : "pointer",
          opacity: saving ? 0.75 : 1,
          boxShadow: `0 4px 14px ${accent}44`,
        }}
      >
        {saving ? "Saving…" : mode === "create" ? "Save read log" : "Save changes"}
      </button>
    </form>
  );
}
