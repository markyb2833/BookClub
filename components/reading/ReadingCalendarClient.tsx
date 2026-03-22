"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import ReadingStatsSection from "@/components/reading/ReadingStatsSection";
import { useTheme } from "@/components/ThemeProvider";

type DayEntry = {
  id: string;
  workId: string;
  title: string;
  coverUrl: string | null;
  medium: string;
  readCycle: number;
  periodStart: string;
  periodEnd: string | null;
  pagesRead: number;
  feedPostId: string | null;
};

type CalendarResponse = { year: number; month: number; days: Record<string, DayEntry[]> };

type CurrentlyReadingBook = { workId: string; title: string; coverUrl: string | null };

type RecentHighlightRow = {
  sessionId: string;
  workId: string;
  workTitle: string;
  text: string;
  page?: number;
  note?: string;
  updatedAt: string;
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

function pad2(n: number) {
  return n < 10 ? `0${n}` : String(n);
}

function monthKey(year: number, month: number, day: number) {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

/** Monday = 0 … Sunday = 6 */
function weekdayMonday0(year: number, month: number) {
  const dow = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  return (dow + 6) % 7;
}

function daysInMonthUtc(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function uniqueByWork(entries: DayEntry[]): DayEntry[] {
  const m = new Map<string, DayEntry>();
  for (const e of entries) {
    if (!m.has(e.workId)) m.set(e.workId, e);
  }
  return [...m.values()];
}

function CalendarDayBooks({ entries, accent }: { entries: DayEntry[]; accent: string }) {
  const uniq = uniqueByWork(entries);
  const shown = uniq.slice(0, 3);
  const more = uniq.length - 3;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        flex: 1,
        marginTop: 2,
        minHeight: 36,
        paddingBottom: 2,
      }}
    >
      {shown.map((e, idx) => (
        <div key={`${e.workId}-${idx}`} style={{ marginLeft: idx ? -7 : 0, zIndex: shown.length - idx, position: "relative" }}>
          {e.coverUrl ? (
            <div
              style={{
                width: 24,
                height: 34,
                borderRadius: 4,
                overflow: "hidden",
                border: "1px solid var(--border)",
                position: "relative",
                boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
                background: "var(--bg)",
              }}
            >
              <Image src={e.coverUrl} alt="" fill sizes="24px" style={{ objectFit: "cover" }} />
            </div>
          ) : (
            <div
              style={{
                width: 24,
                height: 34,
                borderRadius: 4,
                background: `${accent}18`,
                border: `1px solid ${accent}55`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
                lineHeight: 1,
              }}
              aria-hidden
            >
              📖
            </div>
          )}
        </div>
      ))}
      {more > 0 ? (
        <span style={{ marginLeft: 5, fontSize: 10, fontWeight: 800, color: accent, alignSelf: "center", letterSpacing: "-0.02em" }}>+{more}</span>
      ) : null}
    </div>
  );
}

export default function ReadingCalendarClient() {
  const { settings } = useTheme();
  const accent = settings.accentColour;

  const now = new Date();
  const [year, setYear] = useState(now.getUTCFullYear());
  const [month, setMonth] = useState(now.getUTCMonth() + 1);
  const [daysMap, setDaysMap] = useState<Record<string, DayEntry[]>>({});
  const [loading, setLoading] = useState(true);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [readingNow, setReadingNow] = useState<CurrentlyReadingBook[]>([]);
  const [recentHighlights, setRecentHighlights] = useState<RecentHighlightRow[]>([]);

  const loadCurrentlyReading = useCallback(async () => {
    const res = await fetch("/api/reading/currently-reading");
    if (!res.ok) return;
    const d = (await res.json()) as { books?: CurrentlyReadingBook[] };
    setReadingNow(d.books ?? []);
  }, []);

  useEffect(() => {
    void loadCurrentlyReading();
  }, [loadCurrentlyReading]);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/reading/highlights-recent?limit=10")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { highlights?: RecentHighlightRow[] } | null) => {
        if (!cancelled && d?.highlights) setRecentHighlights(d.highlights);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reading/calendar?year=${year}&month=${month}`);
      const d = (await res.json()) as CalendarResponse & { error?: string };
      if (!res.ok) {
        setDaysMap({});
        return;
      }
      setDaysMap(d.days ?? {});
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    void load();
  }, [load]);

  const dim = daysInMonthUtc(year, month);
  const lead = weekdayMonday0(year, month);
  const cells = useMemo(() => {
    const out: ({ kind: "blank" } | { kind: "day"; day: number; key: string; entries: DayEntry[] })[] = [];
    for (let i = 0; i < lead; i++) out.push({ kind: "blank" });
    for (let d = 1; d <= dim; d++) {
      const key = monthKey(year, month, d);
      out.push({ kind: "day", day: d, key, entries: daysMap[key] ?? [] });
    }
    while (out.length % 7 !== 0) out.push({ kind: "blank" });
    return out;
  }, [lead, dim, year, month, daysMap]);

  const title = new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  const selectedEntries = selectedKey ? (daysMap[selectedKey] ?? []) : [];

  function prevMonth() {
    setSelectedKey(null);
    if (month === 1) {
      setMonth(12);
      setYear((y) => y - 1);
    } else setMonth((m) => m - 1);
  }

  function nextMonth() {
    setSelectedKey(null);
    if (month === 12) {
      setMonth(1);
      setYear((y) => y + 1);
    } else setMonth((m) => m + 1);
  }

  return (
    <div
      style={{
        maxWidth: 720,
        margin: "0 auto",
        padding: "clamp(20px, 5vw, 28px) clamp(14px, 4vw, 20px) 80px",
        width: "100%",
        boxSizing: "border-box",
        minWidth: 0,
      }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 22 }}>
        <div style={{ minWidth: 0, flex: "1 1 200px" }}>
          <h1
            style={{
              fontSize: "clamp(22px, 6vw, 28px)",
              fontWeight: 800,
              margin: "0 0 8px",
              letterSpacing: "-0.55px",
              lineHeight: 1.15,
            }}
          >
            Reading
          </h1>
          <p style={{ fontSize: 15, color: "var(--muted)", margin: 0, lineHeight: 1.55, maxWidth: 520 }}>
            Your calendar shows every day a read touched (re-reads and several books at once included). Tap a day for the list.
          </p>
        </div>
        <Link
          href="/reading/new"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "12px 18px",
            minHeight: 44,
            borderRadius: 12,
            background: accent,
            color: "#fff",
            fontWeight: 700,
            fontSize: 14,
            textDecoration: "none",
            boxShadow: `0 4px 14px ${accent}44`,
            boxSizing: "border-box",
          }}
        >
          + Log a read
        </Link>
      </div>

      {readingNow.length > 0 && (
        <section
          style={{
            marginBottom: 22,
            padding: "14px 16px",
            borderRadius: 14,
            border: "1px solid var(--border)",
            background: "var(--surface)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>Quick log · currently reading</span>
            <Link href="/shelves/currently-reading" style={{ fontSize: 12, fontWeight: 600, color: accent, textDecoration: "none" }}>
              Shelf →
            </Link>
          </div>
          <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4, WebkitOverflowScrolling: "touch" }}>
            {readingNow.map((b) => (
              <Link
                key={b.workId}
                href={`/reading/new?work=${encodeURIComponent(b.workId)}`}
                style={{
                  flex: "0 0 auto",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 12px 8px 8px",
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                  background: "var(--bg)",
                  textDecoration: "none",
                  color: "var(--text)",
                  maxWidth: 260,
                }}
              >
                <div style={{ width: 36, height: 54, borderRadius: 6, overflow: "hidden", background: "var(--border)", position: "relative", flexShrink: 0 }}>
                  {b.coverUrl ? (
                    <Image src={b.coverUrl} alt="" fill sizes="36px" style={{ objectFit: "cover" }} />
                  ) : (
                    <span style={{ fontSize: 8, padding: 4, color: "var(--muted)", display: "block" }}>{b.title.slice(0, 8)}</span>
                  )}
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.35, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                  {b.title}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {recentHighlights.length > 0 && (
        <section
          style={{
            marginBottom: 22,
            padding: "14px 16px",
            borderRadius: 14,
            border: "1px solid var(--border)",
            background: "var(--surface)",
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Recent highlights</h2>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>Last 10 saved</span>
          </div>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 12 }}>
            {recentHighlights.map((h, idx) => (
              <li key={`${h.sessionId}-${idx}`} style={{ margin: 0 }}>
                <Link
                  href={`/reading/session/${h.sessionId}`}
                  style={{
                    display: "block",
                    padding: "12px 14px",
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                    background: "var(--bg)",
                    textDecoration: "none",
                    color: "var(--text)",
                  }}
                >
                  <blockquote
                    style={{
                      margin: 0,
                      paddingLeft: 12,
                      borderLeft: `3px solid ${accent}`,
                      fontSize: 14,
                      fontStyle: "italic",
                      lineHeight: 1.5,
                      color: "var(--text)",
                      display: "-webkit-box",
                      WebkitLineClamp: 4,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {h.text}
                  </blockquote>
                  <div style={{ marginTop: 10, fontSize: 12, color: "var(--muted)", lineHeight: 1.45 }}>
                    <span style={{ fontWeight: 600, color: accent }}>{h.workTitle}</span>
                    {h.page != null ? <span> · p. {h.page}</span> : null}
                    {h.note ? <span> · {h.note.length > 80 ? `${h.note.slice(0, 80)}…` : h.note}</span> : null}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div
        className="reading-cal-nav"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          marginBottom: 16,
          padding: "10px 12px",
          borderRadius: 14,
          border: "1px solid var(--border)",
          background: "var(--surface)",
          flexWrap: "wrap",
        }}
      >
        <style>{`
          @media (max-width: 480px) {
            .reading-cal-nav { gap: 10px; }
            .reading-cal-nav h2 { order: -1; width: 100%; flex: none !important; margin-bottom: 2px !important; }
            .reading-cal-nav .reading-cal-nav-btn { flex: 1; min-width: 0; max-width: none; }
          }
        `}</style>
        <button
          type="button"
          onClick={prevMonth}
          className="reading-cal-nav-btn"
          style={{
            padding: "10px 14px",
            minHeight: 44,
            borderRadius: 8,
            border: "1px solid var(--border)",
            background: "var(--surface)",
            cursor: "pointer",
            fontWeight: 600,
            fontSize: 13,
            color: "var(--text)",
          }}
        >
          ← Prev
        </button>
        <h2
          style={{
            margin: 0,
            fontSize: "clamp(15px, 4.2vw, 18px)",
            fontWeight: 700,
            flex: 1,
            minWidth: 0,
            textAlign: "center",
            lineHeight: 1.25,
            padding: "0 4px",
          }}
        >
          {title}
        </h2>
        <button
          type="button"
          onClick={nextMonth}
          className="reading-cal-nav-btn"
          style={{
            padding: "10px 14px",
            minHeight: 44,
            borderRadius: 8,
            border: "1px solid var(--border)",
            background: "var(--surface)",
            cursor: "pointer",
            fontWeight: 600,
            fontSize: 13,
            color: "var(--text)",
          }}
        >
          Next →
        </button>
      </div>

      {loading ? (
        <p style={{ color: "var(--muted)", fontSize: 14 }}>Loading calendar…</p>
      ) : (
        <>
          <div
            className="reading-cal-wrap"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
              gap: 8,
              marginBottom: 20,
              padding: 14,
              borderRadius: 14,
              border: "1px solid var(--border)",
              background: "var(--surface)",
              width: "100%",
              minWidth: 0,
              boxSizing: "border-box",
            }}
          >
            <style>{`
              @media (max-width: 420px) {
                .reading-cal-wrap { gap: 4px !important; padding: 8px !important; }
                .reading-cal-wd { font-size: 9px !important; padding: 2px 0 5px !important; letter-spacing: -0.02em; }
                .reading-cal-cell { min-height: 64px !important; padding: 4px 2px 6px !important; }
              }
            `}</style>
            {WEEKDAYS.map((w) => (
              <div
                key={w}
                className="reading-cal-wd"
                style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textAlign: "center", padding: "4px 0 8px" }}
              >
                {w}
              </div>
            ))}
            {cells.map((c, i) => {
              if (c.kind === "blank") {
                return <div key={`b-${i}`} className="reading-cal-cell" style={{ minHeight: 76 }} />;
              }
              const n = c.entries.length;
              const active = selectedKey === c.key;
              return (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => setSelectedKey(active ? null : c.key)}
                  title={n ? `${n} session${n > 1 ? "s" : ""}` : undefined}
                  className="reading-cal-cell"
                  style={{
                    minHeight: 76,
                    borderRadius: 12,
                    border: active ? `2px solid ${accent}` : "1px solid var(--border)",
                    background: n ? `${accent}12` : "var(--bg)",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "stretch",
                    padding: "6px 4px 8px",
                    color: "var(--text)",
                    transition: "border-color 0.12s, background 0.12s",
                  }}
                >
                  <span style={{ fontSize: 12, fontWeight: 800, marginLeft: 5, lineHeight: 1.2, color: n ? "var(--text)" : "var(--muted)" }}>
                    {c.day}
                  </span>
                  {n > 0 ? (
                    <CalendarDayBooks entries={c.entries} accent={accent} />
                  ) : (
                    <div style={{ flex: 1, minHeight: 36 }} />
                  )}
                </button>
              );
            })}
          </div>

          {selectedKey && (
            <section
              style={{
                borderRadius: 14,
                border: "1px solid var(--border)",
                background: "var(--surface)",
                padding: 16,
              }}
            >
              <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 700 }}>
                {new Date(`${selectedKey}T12:00:00.000Z`).toLocaleDateString("en-GB", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                  timeZone: "UTC",
                })}
              </h3>
              {selectedEntries.length === 0 ? (
                <p style={{ margin: 0, fontSize: 14, color: "var(--muted)" }}>No sessions on this day.</p>
              ) : (
                <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 12 }}>
                  {selectedEntries.map((e) => (
                    <li
                      key={e.id}
                      style={{
                        display: "flex",
                        gap: 12,
                        alignItems: "flex-start",
                        padding: 10,
                        borderRadius: 10,
                        border: "1px solid var(--border)",
                        background: "var(--bg)",
                      }}
                    >
                      <Link href={`/books/${e.workId}`} style={{ flexShrink: 0 }}>
                        <div style={{ width: 40, height: 60, borderRadius: 6, overflow: "hidden", background: "var(--border)", position: "relative" }}>
                          {e.coverUrl ? (
                            <Image src={e.coverUrl} alt="" fill sizes="40px" style={{ objectFit: "cover" }} />
                          ) : (
                            <span style={{ fontSize: 9, padding: 4, color: "var(--muted)", display: "block" }}>{e.title.slice(0, 10)}</span>
                          )}
                        </div>
                      </Link>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <Link href={`/reading/session/${e.id}`} style={{ fontWeight: 700, fontSize: 14, color: accent, textDecoration: "none" }}>
                          {e.title}
                        </Link>
                        <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4, lineHeight: 1.45 }}>
                          Read #{e.readCycle} · {e.medium}
                          {e.periodEnd ? (
                            <>
                              {" "}
                              · {e.periodStart} → {e.periodEnd}
                            </>
                          ) : (
                            <> · from {e.periodStart}</>
                          )}
                          {" · "}
                          {e.pagesRead} pg
                          {e.feedPostId ? " · feed post" : ""}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </>
      )}

      <ReadingStatsSection />
    </div>
  );
}
