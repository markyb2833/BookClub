"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

interface Shelf {
  id: string;
  name: string;
  emoji: string | null;
  isDefault: boolean;
  containsWork: boolean;
  _count: { books: number };
}

const EMOJI_OPTIONS = ["📚", "📖", "⭐", "❤️", "🔖", "🌟", "✅", "🎯", "💡", "🗂️", "🏆", "🌙", "🔥", "💎", "🎭"];

export default function ShelfPopover({
  workId,
  popoverAlign = "right",
}: {
  workId: string;
  /** Where the dropdown anchors (use `left` when the trigger sits on the left side of the card). */
  popoverAlign?: "left" | "right";
}) {
  const { data: session } = useSession();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [shelves, setShelves] = useState<Shelf[]>([]);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmoji, setNewEmoji] = useState("📚");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const loaded = useRef(false);

  const load = useCallback(async () => {
    if (loaded.current) return;
    setLoading(true);
    const res = await fetch(`/api/shelves?workId=${workId}`);
    if (res.ok) {
      setShelves(await res.json());
      loaded.current = true;
    }
    setLoading(false);
  }, [workId]);

  // Load eagerly on mount so the bookmark icon shows correct state immediately
  useEffect(() => {
    if (session?.user) load();
  }, [session?.user, load]);

  useEffect(() => {
    if (!open) return;
    load();
  }, [open, load]);

  useEffect(() => {
    if (creating) setTimeout(() => inputRef.current?.focus(), 50);
  }, [creating]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  async function toggle(shelf: Shelf) {
    if (pending.has(shelf.id)) return;
    setPending((p) => new Set(p).add(shelf.id));
    const wasOn = shelf.containsWork;
    // Optimistic
    setShelves((prev) => prev.map((s) => s.id === shelf.id ? { ...s, containsWork: !wasOn, _count: { books: s._count.books + (wasOn ? -1 : 1) } } : s));
    try {
      if (wasOn) {
        await fetch(`/api/shelves/${shelf.id}/books/${workId}`, { method: "DELETE" });
      } else {
        await fetch(`/api/shelves/${shelf.id}/books`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workId }) });
      }
    } catch {
      // Revert
      setShelves((prev) => prev.map((s) => s.id === shelf.id ? { ...s, containsWork: wasOn, _count: { books: s._count.books + (wasOn ? 1 : -1) } } : s));
    }
    setPending((p) => { const n = new Set(p); n.delete(shelf.id); return n; });
  }

  async function createAndAdd() {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/shelves", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newName.trim(), emoji: newEmoji }) });
      if (!res.ok) return;
      const shelf = await res.json();
      await fetch(`/api/shelves/${shelf.id}/books`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workId }) });
      setShelves((prev) => [...prev, { ...shelf, containsWork: true }]);
      setCreating(false);
      setNewName("");
      setNewEmoji("📚");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  const onShelf = shelves.some((s) => s.containsWork);

  if (!session?.user) {
    return (
      <a href="/login" style={triggerStyle(false)}>
        <BookmarkIcon />
      </a>
    );
  }

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((v) => !v); }}
        style={triggerStyle(onShelf)}
        title="Add to shelf"
      >
        <BookmarkIcon filled={onShelf} />
      </button>

      {open && (
        <div style={{
          position: "absolute",
          top: "calc(100% + 6px)",
          ...(popoverAlign === "left" ? { left: 0 } : { right: 0 }),
          zIndex: 300,
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: 14, width: 240, boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
          overflow: "hidden",
        }}>
          <div style={{ padding: "10px 14px 6px", borderBottom: "1px solid var(--border)" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
              Add to shelf
            </span>
          </div>

          <div style={{ maxHeight: 260, overflowY: "auto" }}>
            {loading ? (
              <div style={{ padding: "20px 14px", color: "var(--muted)", fontSize: 13, textAlign: "center" }}>Loading…</div>
            ) : (
              shelves.map((shelf) => (
                <button
                  key={shelf.id}
                  onClick={() => toggle(shelf)}
                  disabled={pending.has(shelf.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    width: "100%", padding: "9px 14px",
                    background: shelf.containsWork ? `${getAccent()}15` : "transparent",
                    border: "none", cursor: "pointer", textAlign: "left",
                    transition: "background 0.1s",
                    opacity: pending.has(shelf.id) ? 0.5 : 1,
                  }}
                >
                  <span style={{ fontSize: 16, flexShrink: 0 }}>{shelf.emoji ?? "📚"}</span>
                  <span style={{ flex: 1, fontSize: 13, color: "var(--text)", fontWeight: shelf.containsWork ? 600 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {shelf.name}
                  </span>
                  <span style={{ flexShrink: 0 }}>
                    <Checkbox checked={shelf.containsWork} accent={getAccent()} />
                  </span>
                </button>
              ))
            )}
          </div>

          {/* Create shelf inline */}
          {creating ? (
            <div style={{ padding: "10px 14px 14px", borderTop: "1px solid var(--border)" }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
                {EMOJI_OPTIONS.map((e) => (
                  <button key={e} onClick={() => setNewEmoji(e)} style={{ fontSize: 16, background: newEmoji === e ? `${getAccent()}25` : "transparent", border: `1px solid ${newEmoji === e ? getAccent() : "transparent"}`, borderRadius: 6, padding: "2px 4px", cursor: "pointer" }}>{e}</button>
                ))}
              </div>
              <input
                ref={inputRef}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") createAndAdd(); if (e.key === "Escape") setCreating(false); }}
                placeholder="Shelf name…"
                style={{ width: "100%", boxSizing: "border-box", borderRadius: 8, border: "1.5px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: 13, padding: "7px 10px", outline: "none", marginBottom: 8 }}
                onFocus={(e) => { e.target.style.borderColor = getAccent(); }}
                onBlur={(e) => { e.target.style.borderColor = "var(--border)"; }}
              />
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => setCreating(false)} style={{ flex: 1, padding: "7px 0", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--muted)", fontSize: 12, cursor: "pointer" }}>Cancel</button>
                <button onClick={createAndAdd} disabled={saving || !newName.trim()} style={{ flex: 2, padding: "7px 0", borderRadius: 8, border: "none", background: getAccent(), color: "#fff", fontSize: 12, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}>
                  {saving ? "Saving…" : "Create & add"}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setCreating(true)}
              style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "10px 14px", borderTop: "1px solid var(--border)", background: "transparent", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: 13 }}
            >
              <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> New shelf
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function getAccent() {
  if (typeof document !== "undefined") {
    return getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#8b5cf6";
  }
  return "#8b5cf6";
}

function triggerStyle(active: boolean): React.CSSProperties {
  return {
    display: "flex", alignItems: "center", justifyContent: "center",
    width: 32, height: 32, borderRadius: 8,
    background: active ? `${getAccent()}20` : "var(--bg)",
    border: `1.5px solid ${active ? getAccent() : "var(--border)"}`,
    color: active ? getAccent() : "var(--muted)",
    cursor: "pointer", transition: "all 0.15s", flexShrink: 0,
  };
}

function BookmarkIcon({ filled = false }: { filled?: boolean }) {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function Checkbox({ checked, accent }: { checked: boolean; accent: string }) {
  return (
    <div style={{
      width: 18, height: 18, borderRadius: 5,
      border: `2px solid ${checked ? accent : "var(--border)"}`,
      background: checked ? accent : "transparent",
      display: "flex", alignItems: "center", justifyContent: "center",
      transition: "all 0.1s",
    }}>
      {checked && (
        <svg width={10} height={10} viewBox="0 0 12 12" fill="none">
          <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  );
}
