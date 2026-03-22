"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useMemo, type ReactNode } from "react";
import ShelfScene, { type SceneBook, type SceneOrnament } from "./ShelfScene";
import ShelfColourPicker from "./ShelfColourPicker";
import { DEFAULT_SHELF_EMOJIS } from "@/lib/shelves/visual";
import {
  assignWallSlot,
  clampWallCols,
  clampWallRows,
  resizeWallSlots,
  type WallSlots,
} from "@/lib/shelves/libraryWall";
import type { LibraryShelf, LibraryShelfBook } from "@/lib/shelves/libraryShelfTypes";
import { useNarrowLibrary } from "./useNarrowLibrary";

export type { LibraryShelf } from "@/lib/shelves/libraryShelfTypes";

function toSceneBook(b: LibraryShelfBook) {
  return {
    work: b.work,
    sortOrder: b.sortOrder,
    layoutXPct: typeof b.layoutXPct === "number" ? b.layoutXPct : 50,
    layoutYPct: typeof b.layoutYPct === "number" ? b.layoutYPct : 18,
    layoutZ: typeof b.layoutZ === "number" ? b.layoutZ : 5,
    sceneDisplay: b.sceneDisplay ?? null,
    sceneWidthMul: typeof b.sceneWidthMul === "number" ? b.sceneWidthMul : null,
    sceneHeightMul: typeof b.sceneHeightMul === "number" ? b.sceneHeightMul : null,
  };
}

function sameBookIdSetAsSnap(shelf: LibraryShelf, snap: { books: SceneBook[] }) {
  if (shelf.books.length !== snap.books.length) return false;
  const ids = new Set(shelf.books.map((b) => b.work.id));
  for (const b of snap.books) {
    if (!ids.has(b.work.id)) return false;
  }
  return true;
}

const COLOUR_PRESETS = [
  "#c084fc", "#f472b6", "#fb923c", "#fbbf24", "#34d399",
  "#38bdf8", "#818cf8", "#e879f9", "#4ade80", "#f87171",
  "#a78bfa", "#2dd4bf", "#60a5fa", "#fb7185", "#f97316",
];
const BG_PRESETS = [
  "#1a1a2e", "#0f172a", "#1e1b4b", "#14532d", "#1c1917",
  "#fdf4ff", "#f0f9ff", "#f0fdf4", "#fff7ed", "#fef2f2",
  "#1e293b", "#292524", "#312e81", "#4a1942", "#064e3b",
];
const TITLE_PRESETS = [
  "#fafafa", "#f1f5f9", "#e2e8f0", "#0f172a", "#1e293b", "#1c1917",
  "#fef3c7", "#fce7f3", "#ddd6fe", "#bae6fd",
  "#c084fc", "#f472b6", "#fb923c", "#34d399", "#38bdf8", "#f87171",
];

function SimpleModal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="presentation"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 6000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        background: "rgba(0,0,0,0.5)",
      }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="library-modal-title"
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 440,
          maxHeight: "min(90vh, 720px)",
          overflow: "auto",
          background: "var(--surface)",
          borderRadius: 16,
          border: "1px solid var(--border)",
          boxShadow: "0 24px 64px rgba(0,0,0,0.28)",
          padding: 22,
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 18 }}>
          <h2 id="library-modal-title" style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "var(--text)", lineHeight: 1.25 }}>
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              flexShrink: 0,
              width: 36,
              height: 36,
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: "var(--bg)",
              color: "var(--muted)",
              fontSize: 22,
              lineHeight: 1,
              cursor: "pointer",
            }}
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function LibraryFullscreenSheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="library-fullscreen-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 6500,
        display: "flex",
        flexDirection: "column",
        background: "var(--bg)",
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <div
        style={{
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "12px 16px",
          borderBottom: "1px solid var(--border)",
          background: "var(--surface)",
        }}
      >
        <h2
          id="library-fullscreen-title"
          style={{
            margin: 0,
            fontSize: 17,
            fontWeight: 800,
            color: "var(--text)",
            lineHeight: 1.25,
            flex: 1,
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            flexShrink: 0,
            minWidth: 44,
            minHeight: 44,
            borderRadius: 12,
            border: "1px solid var(--border)",
            background: "var(--bg)",
            color: "var(--text)",
            fontSize: 20,
            lineHeight: 1,
            cursor: "pointer",
          }}
        >
          ×
        </button>
      </div>
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflow: "auto",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {children}
      </div>
    </div>
  );
}

const noopBookMove = () => {};

export default function LibraryWall({
  initialWall,
  assignableShelves,
  siteAccent,
  profileUsername,
  visitorPreview = false,
  onBookMove,
  onColourChange,
  onLightingChange,
  onTierCountChange,
}: {
  initialWall: { cols: number; rows: number; slots: WallSlots };
  assignableShelves: LibraryShelf[];
  siteAccent: string;
  /** For “View as guests” links on public shelves. */
  profileUsername: string;
  /** Read-only scenes, no chrome — how others see public shelves. */
  visitorPreview?: boolean;
  onBookMove: (workId: string, fromShelfId: string, toShelfId: string, layout?: { xPct: number; yPct: number }) => void;
  onColourChange: (shelfId: string, field: "bgColour" | "accentColour" | "titleColour", value: string | null) => void;
  onLightingChange: (shelfId: string, preset: string | null) => void;
  onTierCountChange: (shelfId: string, tierCount: number) => void;
}) {
  const [wallCols, setWallCols] = useState(() => clampWallCols(initialWall.cols));
  const [wallRows, setWallRows] = useState(() => clampWallRows(initialWall.rows));
  const [wallSlots, setWallSlots] = useState<WallSlots>(() => [...initialWall.slots]);
  const [wallModalOpen, setWallModalOpen] = useState(false);
  const [slotModalIndex, setSlotModalIndex] = useState<number | null>(null);
  const [fullscreenViewIndex, setFullscreenViewIndex] = useState<number | null>(null);
  const narrow = useNarrowLibrary(720);

  /** Optimistic books + ornaments shared across wall cells, expand, and ⚙️ editor so edits show without reload. */
  const [sceneSnapByShelfId, setSceneSnapByShelfId] = useState<
    Record<string, { books: SceneBook[]; ornaments: SceneOrnament[] }>
  >({});

  const onShelfSceneSnap = useCallback((shelfId: string, books: SceneBook[], ornaments: SceneOrnament[]) => {
    setSceneSnapByShelfId((prev) => {
      const cur = prev[shelfId];
      if (cur && cur.books === books && cur.ornaments === ornaments) return prev;
      return { ...prev, [shelfId]: { books, ornaments } };
    });
  }, []);

  const assignableWithSceneSnaps = useMemo(
    () =>
      assignableShelves.map((shelf) => {
        const snap = sceneSnapByShelfId[shelf.id];
        if (!snap || !sameBookIdSetAsSnap(shelf, snap)) return shelf;
        return {
          ...shelf,
          books: snap.books as unknown as LibraryShelfBook[],
          ornaments: snap.ornaments,
        };
      }),
    [assignableShelves, sceneSnapByShelfId]
  );

  const shelfById = useMemo(
    () => new Map(assignableWithSceneSnaps.map((s) => [s.id, s])),
    [assignableWithSceneSnaps]
  );

  const wallSig = `${initialWall.cols},${initialWall.rows},${JSON.stringify(initialWall.slots)}`;
  useEffect(() => {
    setWallCols((prev) => {
      const n = clampWallCols(initialWall.cols);
      return n === prev ? prev : n;
    });
    setWallRows((prev) => {
      const n = clampWallRows(initialWall.rows);
      return n === prev ? prev : n;
    });
    setWallSlots((prev) => {
      const next = [...initialWall.slots];
      if (prev.length === next.length && prev.every((v, i) => v === next[i])) return prev;
      return next;
    });
  }, [wallSig]);

  useEffect(() => {
    if (!visitorPreview) return;
    setWallModalOpen(false);
    setSlotModalIndex(null);
    setFullscreenViewIndex(null);
  }, [visitorPreview]);

  const skipPersist = useRef(true);
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persistWall = useCallback((cols: number, rows: number, slots: WallSlots) => {
    if (visitorPreview) return;
    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => {
      void fetch("/api/settings/library-wall", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallCols: cols, wallRows: rows, slots }),
      }).catch(() => null);
    }, 420);
  }, [visitorPreview]);

  useEffect(() => {
    if (skipPersist.current) {
      skipPersist.current = false;
      return;
    }
    persistWall(wallCols, wallRows, wallSlots);
  }, [wallCols, wallRows, wallSlots, persistWall]);

  function setCols(next: number) {
    const c = clampWallCols(next);
    if (c === wallCols) return;
    const ns = resizeWallSlots(wallSlots, wallCols, wallRows, c, wallRows);
    setWallCols(c);
    setWallSlots(ns);
  }

  function setRows(next: number) {
    const r = clampWallRows(next);
    if (r === wallRows) return;
    const ns = resizeWallSlots(wallSlots, wallCols, wallRows, wallCols, r);
    setWallRows(r);
    setWallSlots(ns);
  }

  function setSlot(index: number, shelfId: string | null) {
    setWallSlots((prev) => assignWallSlot(prev, index, shelfId));
  }

  const gridCells = wallCols * wallRows;
  /** Desktop: tall rows for the wall aesthetic. Mobile: single column + auto row height so scenes don’t stack huge svh minimums. */
  const displayCols = narrow ? 1 : wallCols;
  /** Narrow: each row at least as tall as Expand’s scene min so fillHeight canvas matches fullscreen layout. */
  const narrowWallSceneRowMin = "minmax(calc(58dvh + 80px), auto)";
  const gridAutoRows = narrow
    ? narrowWallSceneRowMin
    : visitorPreview
      ? "minmax(min(66svh, 820px), auto)"
      : "minmax(min(62vh, 760px), auto)";

  const modalShelfId = slotModalIndex !== null ? (wallSlots[slotModalIndex] ?? null) : null;
  const modalShelf = modalShelfId ? shelfById.get(modalShelfId) : undefined;

  const fullscreenViewShelfId =
    fullscreenViewIndex !== null ? (wallSlots[fullscreenViewIndex] ?? null) : null;
  const fullscreenViewShelf = fullscreenViewShelfId ? shelfById.get(fullscreenViewShelfId) : undefined;

  return (
    <section style={{ marginBottom: 48, width: "100%", maxWidth: "100%", minWidth: 0, boxSizing: "border-box" }}>
      {!visitorPreview && (
        <div style={{ display: "flex", justifyContent: narrow ? "stretch" : "flex-end", marginBottom: 10 }}>
          <button
            type="button"
            onClick={() => setWallModalOpen(true)}
            style={{
              fontSize: 13,
              fontWeight: 600,
              padding: narrow ? "12px 16px" : "8px 14px",
              borderRadius: 10,
              border: `1px solid ${siteAccent}55`,
              background: `${siteAccent}12`,
              color: siteAccent,
              cursor: "pointer",
              width: narrow ? "100%" : undefined,
              minHeight: narrow ? 48 : undefined,
            }}
          >
            Wall layout…
          </button>
        </div>
      )}

      <SimpleModal open={wallModalOpen} title="Wall layout" onClose={() => setWallModalOpen(false)}>
        <p style={{ margin: "0 0 16px", fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>
          Choose how many shelf columns and rows appear on your library page (up to 4×3). Existing assignments are kept when you shrink the grid.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 14, marginBottom: 16 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>Wide</span>
          {[1, 2, 3, 4].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setCols(n)}
              style={{
                minWidth: 36,
                padding: "6px 10px",
                borderRadius: 8,
                border: `1px solid ${wallCols === n ? siteAccent : "var(--border)"}`,
                background: wallCols === n ? `${siteAccent}22` : "var(--bg)",
                color: wallCols === n ? siteAccent : "var(--muted)",
                fontWeight: 600,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              {n}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>Tall</span>
          <button
            type="button"
            onClick={() => setRows(wallRows - 1)}
            disabled={wallRows <= 1}
            style={{
              padding: "6px 14px",
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "var(--bg)",
              cursor: wallRows <= 1 ? "not-allowed" : "pointer",
              opacity: wallRows <= 1 ? 0.45 : 1,
            }}
          >
            −
          </button>
          <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", minWidth: 24, textAlign: "center" }}>{wallRows}</span>
          <button
            type="button"
            onClick={() => setRows(wallRows + 1)}
            disabled={wallRows >= 3}
            style={{
              padding: "6px 14px",
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "var(--bg)",
              cursor: wallRows >= 3 ? "not-allowed" : "pointer",
              opacity: wallRows >= 3 ? 0.45 : 1,
            }}
          >
            +
          </button>
        </div>
      </SimpleModal>

      {slotModalIndex !== null && !narrow && (
        <SimpleModal
          open
          title={modalShelf ? `“${modalShelf.name}” on your wall` : "Assign shelf to slot"}
          onClose={() => setSlotModalIndex(null)}
        >
          {slotModalIndex === null ? null : !modalShelf ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <label style={{ fontSize: 13, color: "var(--muted)" }}>
                Shelf
                <select
                  value=""
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v) {
                      setSlot(slotModalIndex, v);
                      setSlotModalIndex(null);
                    }
                  }}
                  style={{
                    display: "block",
                    width: "100%",
                    marginTop: 6,
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid var(--border)",
                    background: "var(--bg)",
                    color: "var(--text)",
                    fontSize: 16,
                  }}
                >
                  <option value="">Choose a shelf…</option>
                  {assignableShelves.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.emoji ?? "📚"} {s.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : (
            <SlotShelfEditor
              shelf={modalShelf}
              assignableShelves={assignableShelves}
              siteAccent={siteAccent}
              onPickShelf={(id) => {
                if (id === "__clear__") setSlot(slotModalIndex, null);
                else setSlot(slotModalIndex, id);
                setSlotModalIndex(null);
              }}
              onColourChange={onColourChange}
              onTierCountChange={onTierCountChange}
              onClose={() => setSlotModalIndex(null)}
            />
          )}
        </SimpleModal>
      )}

      {slotModalIndex !== null && narrow && (
        <LibraryFullscreenSheet
          open
          title={modalShelf ? `“${modalShelf.name}” · wall` : "Assign shelf to slot"}
          onClose={() => setSlotModalIndex(null)}
        >
          <div
            style={{
              padding: "16px 18px",
              background: modalShelf ? (modalShelf.bgColour ?? "var(--surface)") : "var(--surface)",
            }}
          >
            {slotModalIndex === null ? null : !modalShelf ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <label style={{ fontSize: 14, color: "var(--muted)" }}>
                  Shelf
                  <select
                    value=""
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v) {
                        setSlot(slotModalIndex, v);
                        setSlotModalIndex(null);
                      }
                    }}
                    style={{
                      display: "block",
                      width: "100%",
                      marginTop: 8,
                      padding: "14px 12px",
                      minHeight: 48,
                      borderRadius: 12,
                      border: "1px solid var(--border)",
                      background: "var(--surface)",
                      color: "var(--text)",
                      fontSize: 16,
                    }}
                  >
                    <option value="">Choose a shelf…</option>
                    {assignableShelves.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.emoji ?? "📚"} {s.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ) : (
            <SlotShelfEditor
              shelf={modalShelf}
              assignableShelves={assignableShelves}
              siteAccent={siteAccent}
              onPickShelf={(id) => {
                if (id === "__clear__") setSlot(slotModalIndex, null);
                else setSlot(slotModalIndex, id);
                setSlotModalIndex(null);
              }}
              onColourChange={onColourChange}
              onTierCountChange={onTierCountChange}
              onClose={() => setSlotModalIndex(null)}
            />
            )}
          </div>
          {modalShelf && slotModalIndex !== null ? (
            <div
              style={{
                borderTop: "1px solid var(--border)",
                padding: "14px 16px 28px",
                background: modalShelf.bgColour ?? "var(--surface)",
              }}
            >
              <p
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "var(--muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  margin: "0 0 12px",
                }}
              >
                Edit scene · lighting & decor
              </p>
              <LibraryWallShelfSceneBlock
                shelf={modalShelf}
                shelfAccent={modalShelf.accentColour ?? siteAccent}
                readOnlyScene={visitorPreview}
                bookMove={visitorPreview ? noopBookMove : onBookMove}
                onLightingChange={onLightingChange}
                onSceneSnap={visitorPreview ? undefined : onShelfSceneSnap}
                compact={false}
                fillHeight
              />
            </div>
          ) : null}
        </LibraryFullscreenSheet>
      )}

      {fullscreenViewIndex !== null && fullscreenViewShelf ? (
        <LibraryFullscreenSheet
          open
          title={`${fullscreenViewShelf.emoji ?? DEFAULT_SHELF_EMOJIS[fullscreenViewShelf.slug] ?? "📚"} ${fullscreenViewShelf.name}`}
          onClose={() => setFullscreenViewIndex(null)}
        >
          <div
            style={{
              padding: "12px 16px 24px",
              display: "flex",
              flexDirection: "column",
              minHeight: 0,
              width: "100%",
              maxWidth: "100%",
              boxSizing: "border-box",
              background: fullscreenViewShelf.bgColour ?? "var(--surface)",
            }}
          >
            <LibraryWallShelfSceneBlock
              shelf={fullscreenViewShelf}
              shelfAccent={fullscreenViewShelf.accentColour ?? siteAccent}
              readOnlyScene={visitorPreview}
              bookMove={visitorPreview ? noopBookMove : onBookMove}
              onLightingChange={onLightingChange}
              onSceneSnap={visitorPreview ? undefined : onShelfSceneSnap}
              compact={false}
              fillHeight
            />
          </div>
        </LibraryFullscreenSheet>
      ) : null}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${displayCols}, minmax(0, 1fr))`,
          gridAutoRows: gridAutoRows,
          gap: narrow ? 10 : 14,
          width: "100%",
          minWidth: 0,
        }}
      >
        {Array.from({ length: gridCells }, (_, index) => {
          const shelfId = wallSlots[index] ?? null;
          const shelf = shelfId ? shelfById.get(shelfId) : undefined;

          if (!shelf) {
            return (
              <div
                key={`empty-${index}`}
                style={{
                  border: "2px dashed var(--border)",
                  borderRadius: 16,
                  minHeight: narrow ? 140 : 280,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 12,
                  padding: 20,
                  background: "var(--bg)",
                }}
              >
                {visitorPreview ? (
                  <span style={{ fontSize: 13, color: "var(--muted)" }}>Empty</span>
                ) : (
                  <>
                    <span style={{ fontSize: 13, color: "var(--muted)" }}>Empty slot</span>
                    <button
                      type="button"
                      onClick={() => setSlotModalIndex(index)}
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        padding: "8px 16px",
                        borderRadius: 10,
                        border: `1px solid ${siteAccent}55`,
                        background: `${siteAccent}14`,
                        color: siteAccent,
                        cursor: "pointer",
                      }}
                    >
                      Choose shelf…
                    </button>
                  </>
                )}
              </div>
            );
          }

          const emoji = shelf.emoji ?? DEFAULT_SHELF_EMOJIS[shelf.slug] ?? "📚";
          const shelfAccent = shelf.accentColour ?? siteAccent;
          const shelfBg = shelf.bgColour ?? null;

          return (
            <WallShelfCell
              key={`${shelf.id}-${index}`}
              shelf={shelf}
              emoji={emoji}
              shelfAccent={shelfAccent}
              shelfBg={shelfBg}
              titleColour={shelf.titleColour}
              visitorPreview={visitorPreview}
              profileUsername={profileUsername}
              readOnlyScene={visitorPreview}
              bookMove={visitorPreview ? noopBookMove : onBookMove}
              onOpenExpand={() => {
                setSlotModalIndex(null);
                setFullscreenViewIndex(index);
              }}
              onOpenSettings={
                visitorPreview
                  ? undefined
                  : () => {
                      setFullscreenViewIndex(null);
                      setSlotModalIndex(index);
                    }
              }
              onLightingChange={onLightingChange}
              onSceneSnap={visitorPreview ? undefined : onShelfSceneSnap}
            />
          );
        })}
      </div>
    </section>
  );
}

function LibraryWallShelfSceneBlock({
  shelf,
  shelfAccent,
  readOnlyScene,
  bookMove,
  onLightingChange,
  onSceneSnap,
  compact = true,
  fillHeight = false,
  wallCellNarrow = false,
  scaleLayoutToExpandDesignWidth = false,
}: {
  shelf: LibraryShelf;
  shelfAccent: string;
  readOnlyScene: boolean;
  bookMove: (workId: string, fromShelfId: string, toShelfId: string, layout?: { xPct: number; yPct: number }) => void;
  onLightingChange: (shelfId: string, preset: string | null) => void;
  onSceneSnap?: (shelfId: string, books: SceneBook[], ornaments: SceneOrnament[]) => void;
  compact?: boolean;
  fillHeight?: boolean;
  /** Wall grid on a narrow viewport: short scene, hide edit chrome (use Expand / ⚙️). */
  wallCellNarrow?: boolean;
  /** Grid cells only: match Expand layout width then scale to cell (no horizontal squeeze). */
  scaleLayoutToExpandDesignWidth?: boolean;
}) {
  const memoSceneBooks = useMemo(() => shelf.books.map(toSceneBook), [shelf.books]);
  const tiers = Math.max(2, Math.min(5, shelf.sceneTierCount ?? 2));

  return (
    <ShelfScene
      shelfId={shelf.id}
      shelfAccent={shelfAccent}
      books={memoSceneBooks}
      ornaments={shelf.ornaments}
      lightingPreset={shelf.lightingPreset ?? null}
      tierCount={tiers}
      sceneBookDisplay={shelf.sceneBookDisplay ?? null}
      sceneBookWidthMul={typeof shelf.sceneBookWidthMul === "number" ? shelf.sceneBookWidthMul : 1}
      sceneBookHeightMul={typeof shelf.sceneBookHeightMul === "number" ? shelf.sceneBookHeightMul : 1}
      compact={compact}
      fillHeight={fillHeight}
      readOnly={readOnlyScene}
      wallCellNarrow={wallCellNarrow}
      scaleLayoutToExpandDesignWidth={scaleLayoutToExpandDesignWidth}
      onLightingChange={(preset) => onLightingChange(shelf.id, preset)}
      onCrossShelfBookDrop={(workId, fromShelfId, layout) => bookMove(workId, fromShelfId, shelf.id, layout)}
      onSceneSnap={onSceneSnap}
    />
  );
}

function SlotShelfEditor({
  shelf,
  assignableShelves,
  siteAccent,
  onPickShelf,
  onColourChange,
  onTierCountChange,
  onClose,
}: {
  shelf: LibraryShelf;
  assignableShelves: readonly LibraryShelf[];
  siteAccent: string;
  onPickShelf: (shelfId: string) => void;
  onColourChange: (shelfId: string, field: "bgColour" | "accentColour" | "titleColour", value: string | null) => void;
  onTierCountChange: (shelfId: string, tierCount: number) => void;
  onClose: () => void;
}) {
  const tiers = Math.max(2, Math.min(5, shelf.sceneTierCount ?? 2));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <label style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>
        Shelf in this slot
        <select
          value={shelf.id}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "__clear__") onPickShelf("__clear__");
            else onPickShelf(v);
          }}
          style={{
            display: "block",
            width: "100%",
            marginTop: 6,
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid var(--border)",
            background: "var(--bg)",
            color: "var(--text)",
            fontSize: 14,
          }}
        >
          <option value="__clear__">Remove from wall</option>
          {assignableShelves.map((s) => (
            <option key={s.id} value={s.id}>
              {s.emoji ?? "📚"} {s.name}
            </option>
          ))}
        </select>
      </label>

      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", marginBottom: 8 }}>Plank rows (2–5)</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            type="button"
            disabled={tiers <= 2}
            onClick={() => onTierCountChange(shelf.id, tiers - 1)}
            style={{
              padding: "6px 14px",
              borderRadius: 8,
              border: "1px solid var(--border)",
              cursor: tiers <= 2 ? "not-allowed" : "pointer",
              opacity: tiers <= 2 ? 0.4 : 1,
            }}
          >
            −
          </button>
          <span style={{ fontSize: 16, fontWeight: 700 }}>{tiers}</span>
          <button
            type="button"
            disabled={tiers >= 5}
            onClick={() => onTierCountChange(shelf.id, tiers + 1)}
            style={{
              padding: "6px 14px",
              borderRadius: 8,
              border: "1px solid var(--border)",
              cursor: tiers >= 5 ? "not-allowed" : "pointer",
              opacity: tiers >= 5 ? 0.4 : 1,
            }}
          >
            +
          </button>
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>Accent</span>
        <ShelfColourPicker
          label="Accent"
          value={shelf.accentColour}
          presets={COLOUR_PRESETS}
          onChange={(v) => onColourChange(shelf.id, "accentColour", v)}
          onClear={() => onColourChange(shelf.id, "accentColour", null)}
          onSave={(v) => {
            onColourChange(shelf.id, "accentColour", v);
            void fetch(`/api/shelves/${shelf.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ accentColour: v }),
            });
          }}
        />
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>Background</span>
        <ShelfColourPicker
          label="Background"
          value={shelf.bgColour}
          presets={BG_PRESETS}
          onChange={(v) => onColourChange(shelf.id, "bgColour", v)}
          onClear={() => onColourChange(shelf.id, "bgColour", null)}
          onSave={(v) => {
            onColourChange(shelf.id, "bgColour", v);
            void fetch(`/api/shelves/${shelf.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ bgColour: v }),
            });
          }}
        />
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>Title</span>
        <ShelfColourPicker
          label="Title"
          value={shelf.titleColour}
          presets={TITLE_PRESETS}
          onChange={(v) => onColourChange(shelf.id, "titleColour", v)}
          onClear={() => onColourChange(shelf.id, "titleColour", null)}
          onSave={(v) => {
            onColourChange(shelf.id, "titleColour", v);
            void fetch(`/api/shelves/${shelf.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ titleColour: v }),
            });
          }}
        />
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        <Link
          href={`/shelves/${shelf.slug}`}
          style={{
            fontSize: 13,
            color: siteAccent,
            textDecoration: "none",
            fontWeight: 600,
            border: `1px solid ${siteAccent}44`,
            borderRadius: 10,
            padding: "8px 14px",
          }}
        >
          Open list view
        </Link>
        <button
          type="button"
          onClick={onClose}
          style={{
            fontSize: 13,
            fontWeight: 600,
            padding: "8px 14px",
            borderRadius: 10,
            border: "1px solid var(--border)",
            background: "var(--bg)",
            color: "var(--text)",
            cursor: "pointer",
          }}
        >
          Done
        </button>
      </div>
    </div>
  );
}

function WallShelfCell({
  shelf,
  emoji,
  shelfAccent,
  shelfBg,
  titleColour,
  visitorPreview,
  profileUsername,
  readOnlyScene,
  bookMove,
  onOpenExpand,
  onOpenSettings,
  onLightingChange,
  onSceneSnap,
}: {
  shelf: LibraryShelf;
  emoji: string;
  shelfAccent: string;
  shelfBg: string | null;
  titleColour: string | null;
  visitorPreview: boolean;
  profileUsername: string;
  readOnlyScene: boolean;
  bookMove: (workId: string, fromShelfId: string, toShelfId: string, layout?: { xPct: number; yPct: number }) => void;
  onOpenExpand?: () => void;
  onOpenSettings?: () => void;
  onLightingChange: (shelfId: string, preset: string | null) => void;
  onSceneSnap?: (shelfId: string, books: SceneBook[], ornaments: SceneOrnament[]) => void;
}) {
  const guestHref = `/u/${encodeURIComponent(profileUsername)}/shelves/${encodeURIComponent(shelf.slug)}`;
  const titleStyleColor = titleColour ?? "var(--text)";

  const expandBtnStyle = {
    flexShrink: 0,
    minWidth: 44,
    minHeight: 40,
    padding: "0 12px",
    borderRadius: 10,
    border: "1px solid var(--border)",
    background: "var(--bg)",
    fontSize: 12,
    fontWeight: 700,
    color: "var(--text)",
    cursor: "pointer",
  } as const;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        borderRadius: 16,
        border: `1.5px solid var(--border)`,
        background: shelfBg ?? "var(--surface)",
        overflow: "hidden",
        minHeight: 0,
      }}
    >
      {visitorPreview ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            padding: "8px 12px",
            borderBottom: "1px solid var(--border)",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <span style={{ fontSize: 17, lineHeight: 1 }}>{emoji}</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: titleStyleColor, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {shelf.name}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            {onOpenExpand && (
              <button type="button" onClick={onOpenExpand} aria-label="View shelf full screen" style={expandBtnStyle}>
                Expand
              </button>
            )}
            {shelf.isPublic ? (
              <Link
                href={guestHref}
                style={{ fontSize: 11, fontWeight: 600, color: shelfAccent, textDecoration: "none", whiteSpace: "nowrap", flexShrink: 0 }}
              >
                Public page →
              </Link>
            ) : (
              <span style={{ fontSize: 10, color: "var(--muted)", flexShrink: 0 }}>Private</span>
            )}
          </div>
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 10px",
            borderBottom: "1px solid var(--border)",
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 17, lineHeight: 1 }}>{emoji}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: titleStyleColor, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {shelf.name}
            </div>
            <div style={{ fontSize: 10, color: "var(--muted)" }}>
              {shelf._count.books} book{shelf._count.books !== 1 ? "s" : ""}
              {!shelf.isPublic && <span style={{ marginLeft: 6 }}>· private</span>}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            {onOpenExpand && (
              <button type="button" onClick={onOpenExpand} aria-label="View shelf full screen" style={expandBtnStyle}>
                Expand
              </button>
            )}
            {onOpenSettings && (
              <button
                type="button"
                onClick={onOpenSettings}
                title="Shelf, wall & scene editor"
                aria-label="Shelf wall and scene editor"
                style={{
                  flexShrink: 0,
                  minWidth: 44,
                  minHeight: 44,
                  borderRadius: 10,
                  border: "1px solid var(--border)",
                  background: "var(--bg)",
                  fontSize: 18,
                  lineHeight: 1,
                  cursor: "pointer",
                }}
              >
                ⚙️
              </button>
            )}
          </div>
        </div>
      )}

      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          /* Align with Expand sheet horizontal inset (16px) so scene width matches full editor. */
          padding: "0 16px 10px",
        }}
      >
        <LibraryWallShelfSceneBlock
          shelf={shelf}
          shelfAccent={shelfAccent}
          readOnlyScene={readOnlyScene}
          bookMove={bookMove}
          onLightingChange={onLightingChange}
          onSceneSnap={onSceneSnap}
          /* Same as Expand / fullscreen: non-compact + fillHeight; wallCellNarrow off so chrome & layout match. */
          compact={false}
          fillHeight
          wallCellNarrow={false}
          scaleLayoutToExpandDesignWidth
        />
      </div>
    </div>
  );
}
