"use client";

import { useTheme } from "@/components/ThemeProvider";
import { localCalendarDateString } from "@/lib/reading/readingSessionInput";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type StatsResponse = {
  from: string;
  to: string;
  filters: { workId: string | null; author: string | null };
  sessionCount: number;
  totalHighlightEntries: number;
  sessionsWithHighlights: number;
  booksWithHighlights: number;
  avgHighlightsPerSession: number;
  topBookByHighlights: { workId: string; title: string; highlights: number } | null;
  totalPages: number;
  totalMinutesLogged: number;
  sessionsWithMinutes: number;
  calendarSpanDays: number;
  distinctActivityDays: number;
  distinctReadingDaysWithMinutes: number;
  avgPagesPerCalendarDay: number;
  avgPagesPerActivityDay: number;
  avgMinutesPerReadingDay: number;
  favouriteGenre: { name: string; pages: number } | null;
  favouriteAuthor: { name: string; pages: number } | null;
  favouriteWeekday: { label: string; index: number; pages: number } | null;
  workOptions: { id: string; title: string }[];
  authorOptions: string[];
};

function addDaysLocal(iso: string, delta: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y!, m! - 1, d!);
  dt.setDate(dt.getDate() + delta);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function toLocalYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Rolling windows: `days` calendar dates ending today (inclusive). */
function rollingEndToday(days: number, todayIso: string): { from: string; to: string } {
  return { from: addDaysLocal(todayIso, -(days - 1)), to: todayIso };
}

const RANGE_PRESETS: { id: string; label: string; get: (todayIso: string) => { from: string; to: string } }[] = [
  {
    id: "thisMonth",
    label: "This month",
    get: (todayIso) => {
      const [y, m] = todayIso.split("-").map(Number);
      const from = new Date(y!, m! - 1, 1);
      return { from: toLocalYmd(from), to: todayIso };
    },
  },
  {
    id: "lastMonth",
    label: "Last month",
    get: (todayIso) => {
      const [y, m] = todayIso.split("-").map(Number);
      const firstThis = new Date(y!, m! - 1, 1);
      const lastPrev = new Date(firstThis.getTime() - 86400000);
      const firstPrev = new Date(lastPrev.getFullYear(), lastPrev.getMonth(), 1);
      return { from: toLocalYmd(firstPrev), to: toLocalYmd(lastPrev) };
    },
  },
  {
    id: "thisYear",
    label: "This year",
    get: (todayIso) => {
      const y = Number(todayIso.slice(0, 4));
      const from = new Date(y, 0, 1);
      return { from: toLocalYmd(from), to: todayIso };
    },
  },
  {
    id: "lastYear",
    label: "Last year",
    get: (todayIso) => {
      const y = Number(todayIso.slice(0, 4)) - 1;
      const from = new Date(y, 0, 1);
      const to = new Date(y, 11, 31);
      return { from: toLocalYmd(from), to: toLocalYmd(to) };
    },
  },
  {
    id: "last30",
    label: "Last 30 days",
    get: (todayIso) => rollingEndToday(30, todayIso),
  },
  {
    id: "last90",
    label: "Last 90 days",
    get: (todayIso) => rollingEndToday(90, todayIso),
  },
];

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div
      style={{
        padding: "14px 16px",
        borderRadius: 12,
        border: "1px solid var(--border)",
        background: "var(--bg)",
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.03em", color: "var(--text)" }}>{value}</div>
      {sub ? <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6, lineHeight: 1.4 }}>{sub}</div> : null}
    </div>
  );
}

function presetChipStyle(active: boolean, accent: string): CSSProperties {
  return {
    padding: "8px 14px",
    borderRadius: 999,
    border: `1px solid ${active ? accent : "var(--border)"}`,
    background: active ? `${accent}18` : "var(--bg)",
    color: active ? accent : "var(--text)",
    fontWeight: 600,
    fontSize: 13,
    cursor: "pointer",
    whiteSpace: "nowrap",
  };
}

function BookFilter({
  works,
  workId,
  onWorkIdChange,
  accent,
}: {
  works: { id: string; title: string }[];
  workId: string;
  onWorkIdChange: (id: string) => void;
  accent: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(() => works.find((w) => w.id === workId), [works, workId]);

  useEffect(() => {
    if (selected) setQ(selected.title);
  }, [selected?.id, selected?.title]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    const base = !t ? works : works.filter((w) => w.title.toLowerCase().includes(t));
    return base.slice(0, 80);
  }, [works, q]);

  const n = works.length;

  return (
    <div ref={rootRef} style={{ position: "relative", gridColumn: "span 2" }}>
      <label style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: 6 }}>Book</label>
      <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            onWorkIdChange("");
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={n ? `Search ${n} book${n === 1 ? "" : "s"} in applied range…` : "No books in this range yet"}
          style={{ ...filterInput, flex: 1 }}
        />
        {workId ? (
          <button
            type="button"
            onClick={() => {
              onWorkIdChange("");
              setQ("");
              setOpen(false);
            }}
            style={{
              padding: "0 14px",
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: "var(--surface)",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            Clear
          </button>
        ) : null}
      </div>
      {open && filtered.length > 0 ? (
        <ul
          style={{
            listStyle: "none",
            margin: "6px 0 0",
            padding: 4,
            maxHeight: 240,
            overflowY: "auto",
            borderRadius: 10,
            border: "1px solid var(--border)",
            background: "var(--surface)",
            position: "absolute",
            left: 0,
            right: 0,
            zIndex: 30,
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
          }}
        >
          {filtered.map((w) => (
            <li key={w.id}>
              <button
                type="button"
                onClick={() => {
                  onWorkIdChange(w.id);
                  setQ(w.title);
                  setOpen(false);
                }}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "10px 12px",
                  border: "none",
                  borderRadius: 8,
                  background: w.id === workId ? `${accent}14` : "transparent",
                  cursor: "pointer",
                  fontSize: 14,
                  color: "var(--text)",
                }}
              >
                {w.title}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export default function ReadingStatsSection() {
  const { settings } = useTheme();
  const accent = settings.accentColour;

  const today = useMemo(() => localCalendarDateString(), []);
  const defaultFrom = useMemo(() => addDaysLocal(today, -89), [today]);

  type F = { from: string; to: string; workId: string; author: string };
  const [draft, setDraft] = useState<F>(() => ({ from: defaultFrom, to: today, workId: "", author: "" }));
  const [applied, setApplied] = useState<F>(() => ({ from: defaultFrom, to: today, workId: "", author: "" }));
  const [data, setData] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const query = useMemo(() => {
    const p = new URLSearchParams();
    p.set("from", applied.from);
    p.set("to", applied.to);
    if (applied.workId) p.set("workId", applied.workId);
    if (applied.author.trim()) p.set("author", applied.author.trim());
    return p.toString();
  }, [applied]);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/reading/stats?${query}`);
      const d = (await res.json()) as StatsResponse & { error?: string };
      if (!res.ok) {
        setData(null);
        setErr(typeof d.error === "string" ? d.error : "Could not load stats");
        return;
      }
      setData(d);
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void load();
  }, [load]);

  function applyFilters() {
    setApplied({ ...draft });
  }

  function applyPreset(getRange: (todayIso: string) => { from: string; to: string }) {
    const r = getRange(today);
    setDraft(() => ({ from: r.from, to: r.to, workId: "", author: "" }));
    setApplied({ from: r.from, to: r.to, workId: "", author: "" });
  }

  const presetActive = (getRange: (todayIso: string) => { from: string; to: string }) => {
    const r = getRange(today);
    return applied.from === r.from && applied.to === r.to;
  };

  const authorSuggestions = useMemo(() => (data?.authorOptions ?? []).slice(0, 120), [data?.authorOptions]);

  return (
    <section style={{ marginTop: 36 }}>
      <h2 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 8px", letterSpacing: "-0.4px" }}>Statistics</h2>
      <p style={{ fontSize: 14, color: "var(--muted)", margin: "0 0 14px", lineHeight: 1.5, maxWidth: 620 }}>
        Quick ranges set dates and refresh immediately. Custom from/to need <strong>Apply</strong>. The book list always matches the{" "}
        <strong>applied</strong> range (not the date fields until you Apply).
      </p>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          marginBottom: 16,
          padding: "4px 0",
        }}
      >
        {RANGE_PRESETS.map((p) => (
          <button key={p.id} type="button" onClick={() => applyPreset(p.get)} style={presetChipStyle(presetActive(p.get), accent)}>
            {p.label}
          </button>
        ))}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(min(140px, 100%), 1fr))",
          gap: 12,
          marginBottom: 20,
          padding: 16,
          borderRadius: 14,
          border: "1px solid var(--border)",
          background: "var(--surface)",
        }}
      >
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: 6 }}>From</label>
          <input
            type="date"
            value={draft.from}
            onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))}
            style={filterInput}
          />
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: 6 }}>To</label>
          <input
            type="date"
            value={draft.to}
            onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))}
            style={filterInput}
          />
        </div>

        <BookFilter
          key={`${applied.from}-${applied.to}`}
          works={data?.workOptions ?? []}
          workId={draft.workId}
          onWorkIdChange={(id) => setDraft((d) => ({ ...d, workId: id }))}
          accent={accent}
        />

        <div style={{ gridColumn: "1 / -1" }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: 6 }}>Author</label>
          <input
            list="reading-stats-authors"
            value={draft.author}
            onChange={(e) => setDraft((d) => ({ ...d, author: e.target.value }))}
            placeholder="Filter by author on the work…"
            style={filterInput}
          />
          <datalist id="reading-stats-authors">
            {authorSuggestions.map((a) => (
              <option key={a} value={a} />
            ))}
          </datalist>
          {(data?.authorOptions.length ?? 0) > 120 ? (
            <span style={{ fontSize: 11, color: "var(--muted)", display: "block", marginTop: 6 }}>
              Showing 120 author hints — type to match any name in range.
            </span>
          ) : null}
        </div>
        <div style={{ display: "flex", alignItems: "flex-end" }}>
          <button
            type="button"
            onClick={() => applyFilters()}
            style={{
              padding: "10px 18px",
              borderRadius: 10,
              border: "none",
              background: accent,
              color: "#fff",
              fontWeight: 700,
              fontSize: 14,
              cursor: "pointer",
              width: "100%",
            }}
          >
            Apply
          </button>
        </div>
      </div>

      {err && (
        <p style={{ color: "#b91c1c", fontSize: 14, marginBottom: 16 }}>
          {err}
        </p>
      )}

      {loading && data ? (
        <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 10px" }}>Updating…</p>
      ) : null}

      {loading && !data ? (
        <p style={{ color: "var(--muted)", fontSize: 14 }}>Loading statistics…</p>
      ) : data ? (
        <>
          <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 16px" }}>
            Range <strong>{data.from}</strong> → <strong>{data.to}</strong>
            {data.sessionCount === 0 ? " · no sessions match" : ` · ${data.sessionCount} session${data.sessionCount === 1 ? "" : "s"}`}
            {data.workOptions.length > 0 ? ` · ${data.workOptions.length} book${data.workOptions.length === 1 ? "" : "s"} in range` : null}
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(min(160px, 100%), 1fr))",
              gap: 12,
            }}
          >
            <StatCard
              label="Avg pages / day (range)"
              value={data.calendarSpanDays > 0 ? String(data.avgPagesPerCalendarDay) : "—"}
              sub={`${data.totalPages} pages over ${data.calendarSpanDays} calendar days`}
            />
            <StatCard
              label="Avg pages / activity day"
              value={data.distinctActivityDays > 0 ? String(data.avgPagesPerActivityDay) : "—"}
              sub={`${data.distinctActivityDays} distinct streak days with logs`}
            />
            <StatCard
              label="Avg reading time / day (split)"
              value={
                data.distinctReadingDaysWithMinutes > 0 && data.totalMinutesLogged > 0
                  ? `${data.avgMinutesPerReadingDay} min`
                  : "—"
              }
              sub={
                data.sessionsWithMinutes > 0
                  ? `${data.totalMinutesLogged} min total · split evenly across each log’s date range (${data.distinctReadingDaysWithMinutes} day${data.distinctReadingDaysWithMinutes === 1 ? "" : "s"} in range)`
                  : "Add minutes on your read logs to see this"
              }
            />
            <StatCard
              label="Top genre (by pages)"
              value={data.favouriteGenre?.name ?? "—"}
              sub={data.favouriteGenre ? `~${data.favouriteGenre.pages} pages attributed` : undefined}
            />
            <StatCard
              label="Top author (by pages)"
              value={data.favouriteAuthor?.name ?? "—"}
              sub={data.favouriteAuthor ? `~${data.favouriteAuthor.pages} pages (primary author per book)` : undefined}
            />
            <StatCard
              label="Favourite weekday"
              value={data.favouriteWeekday?.label ?? "—"}
              sub={data.favouriteWeekday ? `Most pages on streak days (${data.favouriteWeekday.pages} pg)` : undefined}
            />
            <StatCard
              label="Highlights saved"
              value={data.totalHighlightEntries > 0 ? String(data.totalHighlightEntries) : "—"}
              sub={
                data.totalHighlightEntries > 0
                  ? `Across ${data.sessionsWithHighlights} session${data.sessionsWithHighlights === 1 ? "" : "s"} · ${data.booksWithHighlights} book${data.booksWithHighlights === 1 ? "" : "s"}`
                  : "Add passages on read logs to track quotes"
              }
            />
            <StatCard
              label="Avg highlights / session"
              value={data.sessionCount > 0 ? String(data.avgHighlightsPerSession) : "—"}
              sub={data.sessionCount > 0 ? `Mean over ${data.sessionCount} session${data.sessionCount === 1 ? "" : "s"} in range` : undefined}
            />
            <StatCard
              label="Top book (highlights)"
              value={
                data.topBookByHighlights
                  ? `${data.topBookByHighlights.highlights} passage${data.topBookByHighlights.highlights === 1 ? "" : "s"}`
                  : "—"
              }
              sub={data.topBookByHighlights ? data.topBookByHighlights.title : undefined}
            />
          </div>
        </>
      ) : null}
    </section>
  );
}

const filterInput: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  borderRadius: 10,
  border: "1px solid var(--border)",
  padding: "10px 12px",
  fontSize: 14,
  background: "var(--bg)",
  color: "var(--text)",
};
