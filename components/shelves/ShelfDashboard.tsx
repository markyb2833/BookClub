"use client";

import { useState, useCallback } from "react";
import NextImage from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "@/components/ThemeProvider";
import LibraryWall from "./LibraryWall";
import type { WallSlots } from "@/lib/shelves/libraryWall";
import { DEFAULT_SHELF_EMOJIS, spineColour } from "@/lib/shelves/visual";

interface Author { name: string }
interface Work {
  id: string;
  title: string;
  coverUrl: string | null;
  averageRating: number;
  ratingsCount?: number;
  communityRatingAvg?: number;
  communityReviewCount?: number;
  recommendationsReceivedCount?: number;
  workAuthors: { author: Author }[];
}
interface ShelfBook {
  work: Work;
  sortOrder: number;
  layoutXPct?: number;
  layoutYPct?: number;
  layoutZ?: number;
}
interface ShelfOrnamentRow {
  id: string;
  glyph: string;
  imageUrl?: string | null;
  xPct: number;
  yPct: number;
  zIndex: number;
  scale: number;
}
interface Shelf {
  id: string; name: string; emoji: string | null; slug: string;
  isDefault: boolean; isPublic: boolean; sortOrder: number;
  bgColour: string | null; accentColour: string | null; titleColour: string | null;
  lightingPreset: string | null;
  sceneTierCount: number;
  books: ShelfBook[];
  ornaments: ShelfOrnamentRow[];
  _count: { books: number };
}

const EMOJI_OPTIONS = ["📚", "📖", "⭐", "❤️", "🔖", "🌟", "✅", "🎯", "💡", "🗂️", "🏆", "🌙", "🔥", "💎", "🎭"];
// ─── Currently Reading Card ──────────────────────────────────────────────────

function CurrentlyReadingCard({ book }: { book: ShelfBook }) {
  const { settings } = useTheme();
  return (
    <Link
      href={`/books/${book.work.id}`}
      style={{ display: "flex", flexDirection: "column", gap: 10, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 16, textDecoration: "none", width: 200, flexShrink: 0, transition: "box-shadow 0.15s, transform 0.15s" }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 24px rgba(0,0,0,0.12)"; (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "none"; (e.currentTarget as HTMLElement).style.transform = "none"; }}
    >
      <div style={{ width: "100%", height: 120, borderRadius: 8, overflow: "hidden", background: "var(--border)", position: "relative" }}>
        {book.work.coverUrl ? (
          <NextImage src={book.work.coverUrl} alt={book.work.title} fill style={{ objectFit: "cover" }} sizes="200px" />
        ) : (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }}>
            <span style={{ fontSize: 12, color: "var(--muted)", textAlign: "center" }}>{book.work.title}</span>
          </div>
        )}
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", lineHeight: 1.3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
        {book.work.title}
      </div>
      <div style={{ height: 4, borderRadius: 99, background: "var(--border)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: "40%", background: settings.accentColour, borderRadius: 99 }} />
      </div>
    </Link>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function ShelfDashboard({ shelves: initial, username, displayName, libraryWall }: {
  shelves: Shelf[];
  username: string;
  displayName: string | null;
  libraryWall: { cols: number; rows: number; slots: WallSlots };
}) {
  const { settings } = useTheme();
  const router = useRouter();
  const [shelves, setShelves] = useState<Shelf[]>(initial);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmoji, setNewEmoji] = useState("📚");
  const [newDesc, setNewDesc] = useState("");
  const [newPublic, setNewPublic] = useState(true);
  const [creating, setCreating] = useState(false);
  /** Preview wall as a visitor would see it (read-only scenes, no wall chrome). */
  const [visitorPreview, setVisitorPreview] = useState(false);

  const accent = settings.accentColour;
  const currentlyReading = shelves.find(s => s.slug === "currently-reading");
  const assignableShelves = shelves.filter(s => s.slug !== "currently-reading");
  const totalBooks = new Set(shelves.flatMap(s => s.books.map(b => b.work.id))).size;

  // ── Create shelf ──────────────────────────────────────────────────────────

  async function createShelf() {
    if (!newName.trim()) return;
    setCreating(true);
    const res = await fetch("/api/shelves", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim(), emoji: newEmoji, description: newDesc, isPublic: newPublic }),
    });
    if (res.ok) {
      const shelf = await res.json();
      setShelves(prev => [...prev, {
        ...shelf,
        books: [],
        ornaments: [],
        lightingPreset: null,
        bgColour: null,
        accentColour: null,
        titleColour: null,
        sceneTierCount: typeof shelf.sceneTierCount === "number" ? shelf.sceneTierCount : 2,
      }]);
      setShowCreate(false); setNewName(""); setNewEmoji("📚"); setNewDesc("");
      router.refresh();
    }
    setCreating(false);
  }

  // ── Cross-shelf book move ─────────────────────────────────────────────────

  const handleBookMove = useCallback((workId: string, fromShelfId: string, toShelfId: string, layout?: { xPct: number; yPct: number }) => {
    if (fromShelfId === toShelfId) return;
    const layoutXPct = layout?.xPct;
    const layoutYPct = layout?.yPct;
    setShelves(prev => {
      const fromShelf = prev.find(s => s.id === fromShelfId);
      const book = fromShelf?.books.find(b => b.work.id === workId);
      if (!book) return prev;
      const moved: ShelfBook = {
        ...book,
        sortOrder: (prev.find(s => s.id === toShelfId)?.books.length ?? 0) * 10,
        ...(layoutXPct !== undefined ? { layoutXPct } : {}),
        ...(layoutYPct !== undefined ? { layoutYPct } : {}),
        layoutZ: 5,
      };
      return prev.map(s => {
        if (s.id === fromShelfId) return { ...s, books: s.books.filter(b => b.work.id !== workId), _count: { books: s._count.books - 1 } };
        if (s.id === toShelfId) return { ...s, books: [...s.books, moved], _count: { books: s._count.books + 1 } };
        return s;
      });
    });
    fetch(`/api/shelves/${toShelfId}/books/move`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workId,
        fromShelfId,
        ...(layoutXPct !== undefined ? { layoutXPct } : {}),
        ...(layoutYPct !== undefined ? { layoutYPct } : {}),
      }),
    }).then(() => router.refresh());
  }, [router]);

  const handleLightingChange = useCallback((shelfId: string, preset: string | null) => {
    setShelves(prev => prev.map(s => (s.id === shelfId ? { ...s, lightingPreset: preset } : s)));
  }, []);

  // ── Per-shelf colour update ───────────────────────────────────────────────

  const handleColourChange = useCallback((shelfId: string, field: "bgColour" | "accentColour" | "titleColour", value: string | null) => {
    setShelves(prev => prev.map(s => s.id === shelfId ? { ...s, [field]: value } : s));
  }, []);

  const handleTierCountChange = useCallback((shelfId: string, tierCount: number) => {
    const n = Math.max(2, Math.min(5, tierCount));
    setShelves(prev => prev.map(s => (s.id === shelfId ? { ...s, sceneTierCount: n } : s)));
    fetch(`/api/shelves/${shelfId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sceneTierCount: n }),
    }).catch(() => null);
  }, []);

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "40px 24px 80px" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 40, flexWrap: "wrap", gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: "var(--text)", margin: 0, letterSpacing: "-0.5px" }}>
            {displayName ?? username}&apos;s Library
          </h1>
          <p style={{ fontSize: 14, color: "var(--muted)", marginTop: 6 }}>
            {totalBooks} book{totalBooks !== 1 ? "s" : ""} · {shelves.length} {shelves.length !== 1 ? "shelves" : "shelf"}
            {currentlyReading && currentlyReading._count.books > 0 && ` · ${currentlyReading._count.books} reading now`}
          </p>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
          <div
            role="group"
            aria-label="Library view mode"
            style={{
              display: "inline-flex",
              borderRadius: 10,
              border: "1px solid var(--border)",
              overflow: "hidden",
              background: "var(--bg)",
            }}
          >
            <button
              type="button"
              onClick={() => setVisitorPreview(false)}
              style={{
                padding: "8px 14px",
                fontSize: 13,
                fontWeight: 600,
                border: "none",
                cursor: "pointer",
                background: !visitorPreview ? `${accent}22` : "transparent",
                color: !visitorPreview ? accent : "var(--muted)",
              }}
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => { setVisitorPreview(true); setShowCreate(false); }}
              style={{
                padding: "8px 14px",
                fontSize: 13,
                fontWeight: 600,
                border: "none",
                borderLeft: "1px solid var(--border)",
                cursor: "pointer",
                background: visitorPreview ? `${accent}22` : "transparent",
                color: visitorPreview ? accent : "var(--muted)",
              }}
            >
              Guest view
            </button>
          </div>
          {!visitorPreview && (
            <button
              onClick={() => setShowCreate(v => !v)}
              style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 18px", borderRadius: 10, background: accent, color: "#fff", border: "none", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
            >
              <span style={{ fontSize: 18, lineHeight: 1 }}>+</span> New shelf
            </button>
          )}
        </div>
      </div>

      {/* Create shelf form */}
      {!visitorPreview && showCreate && (
        <div style={{ background: "var(--surface)", border: `2px solid ${accent}40`, borderRadius: 16, padding: 24, marginBottom: 32, boxShadow: `0 4px 24px ${accent}15` }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", margin: "0 0 16px" }}>Create a new shelf</h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
            {EMOJI_OPTIONS.map((e) => (
              <button key={e} onClick={() => setNewEmoji(e)} style={{ fontSize: 20, padding: "4px 6px", borderRadius: 8, background: newEmoji === e ? `${accent}25` : "var(--bg)", border: `1.5px solid ${newEmoji === e ? accent : "var(--border)"}`, cursor: "pointer", transition: "all 0.1s" }}>{e}</button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 200, background: "var(--bg)", border: "1.5px solid var(--border)", borderRadius: 10, padding: "10px 14px" }}>
              <span style={{ fontSize: 22 }}>{newEmoji}</span>
              <input
                value={newName} onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") createShelf(); }}
                placeholder="Shelf name…"
                style={{ flex: 1, border: "none", background: "transparent", fontSize: 15, color: "var(--text)", outline: "none", fontWeight: 500 }}
              />
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--muted)", cursor: "pointer", padding: "0 4px" }}>
              <div onClick={() => setNewPublic(v => !v)} style={{ width: 36, height: 20, borderRadius: 99, background: newPublic ? accent : "var(--border)", position: "relative", transition: "background 0.2s", cursor: "pointer", flexShrink: 0 }}>
                <div style={{ position: "absolute", top: 2, left: newPublic ? 18 : 2, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
              </div>
              {newPublic ? "Public" : "Private"}
            </label>
          </div>
          <textarea
            value={newDesc} onChange={(e) => setNewDesc(e.target.value)}
            placeholder="Description (optional)…"
            rows={2}
            style={{ width: "100%", boxSizing: "border-box", borderRadius: 10, border: "1.5px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: 13, padding: "10px 14px", outline: "none", resize: "vertical", marginBottom: 12, fontFamily: "inherit" }}
          />
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={() => setShowCreate(false)} style={{ padding: "8px 18px", borderRadius: 9, border: "1px solid var(--border)", background: "transparent", color: "var(--muted)", fontSize: 13, cursor: "pointer" }}>Cancel</button>
            <button onClick={createShelf} disabled={creating || !newName.trim()} style={{ padding: "8px 22px", borderRadius: 9, border: "none", background: accent, color: "#fff", fontSize: 13, fontWeight: 600, cursor: creating ? "not-allowed" : "pointer", opacity: creating ? 0.7 : 1 }}>
              {creating ? "Creating…" : "Create shelf"}
            </button>
          </div>
        </div>
      )}

      {/* Currently Reading */}
      {currentlyReading && (
        <section style={{ marginBottom: 48 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <h2 style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase", margin: 0 }}>
              📖 Currently Reading
            </h2>
            <Link href="/shelves/currently-reading" style={{ fontSize: 13, color: "var(--muted)", textDecoration: "none", fontWeight: 500 }}>View all →</Link>
          </div>
          {currentlyReading.books.length === 0 ? (
            <div style={{ background: "var(--surface)", border: "1.5px dashed var(--border)", borderRadius: 14, padding: "32px 24px", textAlign: "center" }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📖</div>
              <p style={{ color: "var(--muted)", fontSize: 14, margin: 0 }}>Nothing in progress — <Link href="/search" style={{ color: accent, textDecoration: "none", fontWeight: 500 }}>find your next read</Link></p>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 8 }}>
              {currentlyReading.books.map(b => <CurrentlyReadingCard key={b.work.id} book={b} />)}
            </div>
          )}
        </section>
      )}

      <LibraryWall
        initialWall={libraryWall}
        assignableShelves={assignableShelves}
        siteAccent={accent}
        profileUsername={username}
        visitorPreview={visitorPreview}
        onBookMove={handleBookMove}
        onColourChange={handleColourChange}
        onLightingChange={handleLightingChange}
        onTierCountChange={handleTierCountChange}
      />
    </div>
  );
}
