"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  bookSceneDimensions,
  normalizeSceneBookDisplay,
  resolveBookCenterXPctNoOverlap,
  type BookSceneDisplayMode,
} from "@/lib/shelves/bookSceneLayout";
import { spineColour } from "@/lib/shelves/visual";
import { validateOrnamentDataImageUrl } from "@/lib/shelves/ornamentImage";
import {
  PLANK_HEIGHT,
  PLANK_INSET,
  clearanceAboveShelf,
  computePlankBottomOffsetsPx,
  nearestShelfIndex as nearestPlankIndex,
  shelfIndexFromLayoutYPct,
  snapBottomPxToPct as snapBottomToPct,
  snapLayoutYPctToShelfSurface,
  surfacePxFromBottom,
} from "@/lib/shelves/plankLayout";
import BookSpineHoverCard from "./BookSpineHoverCard";

interface Author {
  name: string;
}
interface Work {
  id: string;
  title: string;
  coverUrl: string | null;
  averageRating: number;
  ratingsCount?: number;
  communityRatingAvg?: number;
  communityReviewCount?: number;
  recommendationsReceivedCount?: number;
  readingProgressPercent?: number | null;
  workAuthors: { author: Author }[];
}

export interface SceneBook {
  work: Work;
  sortOrder: number;
  layoutXPct: number;
  layoutYPct: number;
  layoutZ: number;
  /** null = inherit shelf scene defaults */
  sceneDisplay?: string | null;
  sceneWidthMul?: number | null;
  sceneHeightMul?: number | null;
}

export interface SceneOrnament {
  id: string;
  glyph: string;
  imageUrl?: string | null;
  xPct: number;
  yPct: number;
  zIndex: number;
  scale: number;
}

const LIGHTING_PRESETS: { id: string; label: string }[] = [
  { id: "none", label: "Off" },
  { id: "warm", label: "Warm" },
  { id: "cool", label: "Cool" },
  { id: "lamp", label: "Lamp" },
  { id: "fairy", label: "Fairy" },
  { id: "midnight", label: "Midnight" },
];

const ORNAMENT_PICKS = ["🪴", "🕯️", "✨", "🖼️", "☕", "🐈", "📷", "🎭", "🏺", "🌙", "💡", "🧸", "🎪", "⚜️"];

const ORNAMENT_SCALE_MIN = 0.4;
const ORNAMENT_SCALE_MAX = 2.5;
const ORNAMENT_SCALE_STEP = 0.05;
/** Movement past this (px) from pointer-down turns an ornament tap into a drag. */
const ORNAMENT_TAP_DRAG_THRESHOLD_PX = 12;
const BOOK_TAP_DRAG_THRESHOLD_PX = 12;

const FAIRY_BULB_COUNT = 18;

/** Emoji + uploaded images share the same base emblem size (before `scale`) so uploads match premade decor. */
function ornamentEmblemBasePx(ornClearancePx: number) {
  return Math.min(32, Math.max(20, Math.round(ornClearancePx * 0.28)));
}

function buildOrderPayload(books: SceneBook[]) {
  const sorted = [...books].sort(
    (a, b) =>
      b.layoutYPct - a.layoutYPct ||
      a.layoutXPct - b.layoutXPct ||
      a.sortOrder - b.sortOrder
  );
  return sorted.map((b, i) => ({
    workId: b.work.id,
    sortOrder: i * 10,
    layoutXPct: b.layoutXPct,
    layoutYPct: b.layoutYPct,
    layoutZ: b.layoutZ,
  }));
}

function lightingStyle(preset: string | null | undefined, accent: string): React.CSSProperties {
  const base: React.CSSProperties = {};
  switch (preset) {
    case "warm":
      return {
        ...base,
        filter: "sepia(0.16) saturate(1.1) brightness(1.02)",
        boxShadow: `inset 0 -36px 64px rgba(255, 150, 80, 0.11)`,
      };
    case "cool":
      return {
        ...base,
        filter: "saturate(0.94) hue-rotate(-10deg) brightness(1.02)",
        boxShadow: `inset 0 -32px 56px rgba(100, 150, 220, 0.11)`,
      };
    case "lamp":
      return {
        ...base,
        boxShadow: `inset 0 -40px 72px rgba(255, 190, 120, 0.14), inset 18% -28px 80px rgba(0,0,0,0.06)`,
      };
    case "fairy":
      return {
        ...base,
        boxShadow: `inset 0 -28px 52px rgba(130, 100, 190, 0.09)`,
      };
    case "midnight":
      return {
        ...base,
        filter: "brightness(0.9) contrast(1.06)",
        boxShadow: `inset 0 -48px 80px rgba(0,0,0,0.32), inset 0 0 36px ${accent}14`,
      };
    default:
      return { ...base, boxShadow: `inset 0 -24px 44px rgba(0,0,0,0.07)` };
  }
}

function accentRgb(shelfAccent: string): { hex: string; rgb: string } {
  const s = shelfAccent.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(s)) {
    const r = parseInt(s.slice(1, 3), 16);
    const g = parseInt(s.slice(3, 5), 16);
    const b = parseInt(s.slice(5, 7), 16);
    return { hex: s, rgb: `${r},${g},${b}` };
  }
  return { hex: "#8b5cf6", rgb: "139,92,246" };
}

type LightStringPalette = {
  stringOpacity: number;
  wireGradient: string;
  wireOpacity: number;
  bulbGlow: string;
  bulbHex: string;
  bulbColors: readonly string[];
};

function lightStringPalette(preset: string | null | undefined, shelfAccent: string): LightStringPalette {
  const { hex, rgb } = accentRgb(shelfAccent);

  switch (preset) {
    case "warm":
      return {
        stringOpacity: 1,
        wireOpacity: 0.92,
        wireGradient:
          "linear-gradient(90deg, transparent 0%, rgba(255,170,95,0.5) 5%, rgba(255,130,60,0.35) 50%, rgba(255,170,95,0.5) 95%, transparent 100%)",
        bulbGlow: "rgba(255, 200, 130, 0.48)",
        bulbHex: hex,
        bulbColors: ["#fff8ec", "#ffe8c8", "#ffd8a0", "#fff0dc"],
      };
    case "cool":
      return {
        stringOpacity: 1,
        wireOpacity: 0.9,
        wireGradient:
          "linear-gradient(90deg, transparent 0%, rgba(120,175,255,0.45) 5%, rgba(80,140,240,0.32) 50%, rgba(120,175,255,0.45) 95%, transparent 100%)",
        bulbGlow: "rgba(160, 200, 255, 0.45)",
        bulbHex: hex,
        bulbColors: ["#f2f8ff", "#dceaff", "#cce4ff", "#e8f2ff"],
      };
    case "lamp":
      return {
        stringOpacity: 1,
        wireOpacity: 0.95,
        wireGradient:
          "linear-gradient(90deg, transparent 0%, rgba(255,200,120,0.55) 5%, rgba(255,170,80,0.4) 50%, rgba(255,200,120,0.55) 95%, transparent 100%)",
        bulbGlow: "rgba(255, 230, 180, 0.52)",
        bulbHex: hex,
        bulbColors: ["#fffdf5", "#fff0d0", "#ffe8b8", "#fff8e8"],
      };
    case "fairy":
      return {
        stringOpacity: 1,
        wireOpacity: 0.9,
        wireGradient: `linear-gradient(90deg, transparent 0%, rgba(${rgb},0.55) 5%, rgba(${rgb},0.38) 50%, rgba(${rgb},0.55) 95%, transparent 100%)`,
        bulbGlow: `rgba(${rgb}, 0.5)`,
        bulbHex: hex,
        bulbColors: ["#fffef6", "#ffe8f2", "#f0e8ff", "#e8f8ff"],
      };
    case "midnight":
      return {
        stringOpacity: 0.94,
        wireOpacity: 0.78,
        wireGradient: `linear-gradient(90deg, transparent 0%, rgba(${rgb},0.38) 6%, rgba(70,60,110,0.42) 50%, rgba(${rgb},0.38) 94%, transparent 100%)`,
        bulbGlow: `rgba(${rgb}, 0.4)`,
        bulbHex: hex,
        bulbColors: ["#c8bce8", "#a898d8", "#e0d8f4", "#b0a0d0"],
      };
    case "none":
    default:
      return {
        stringOpacity: 0.42,
        wireOpacity: 0.55,
        wireGradient:
          "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.16) 6%, rgba(255,255,255,0.09) 50%, rgba(255,255,255,0.16) 94%, transparent 100%)",
        bulbGlow: "rgba(200, 200, 210, 0.22)",
        bulbHex: "#a8a8b8",
        bulbColors: ["#c8c8d0", "#b8b8c2", "#d0d0d8", "#a8a8b4"],
      };
  }
}

function ShelfLightString({
  preset,
  shelfAccent,
}: {
  preset: string | null | undefined;
  shelfAccent: string;
}) {
  const pal = lightStringPalette(preset, shelfAccent);
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        left: PLANK_INSET + 2,
        right: PLANK_INSET + 2,
        top: 10,
        height: 18,
        zIndex: 48,
        pointerEvents: "none",
        opacity: pal.stringOpacity,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 6,
          height: 2,
          borderRadius: 1,
          background: pal.wireGradient,
          opacity: pal.wireOpacity,
        }}
      />
      <div
        style={{
          position: "relative",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          height: "100%",
          paddingLeft: 2,
          paddingRight: 2,
        }}
      >
        {Array.from({ length: FAIRY_BULB_COUNT }, (_, i) => {
          const sz = 5 + (i % 3);
          const bg = pal.bulbColors[i % pal.bulbColors.length];
          return (
            <span
              key={i}
              className="shelf-fairy-bulb"
              style={{
                width: sz,
                height: sz,
                borderRadius: "50%",
                marginTop: 1,
                background: bg,
                boxShadow: `0 0 5px 1px ${pal.bulbHex}aa, 0 0 12px 2px ${pal.bulbGlow}`,
                animationDelay: `${i * 0.09}s`,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

export default function ShelfScene({
  shelfId,
  shelfAccent,
  books: booksProp,
  ornaments: ornamentsProp,
  lightingPreset,
  tierCount: tierCountProp = 3,
  compact = false,
  fillHeight = false,
  wallCellNarrow = false,
  /** Library wall grid only: layout at Expand design width, then scale down so % positions match Expand (no squeeze). */
  scaleLayoutToExpandDesignWidth = false,
  readOnly = false,
  onLightingChange,
  onCrossShelfBookDrop,
  onSceneSnap,
  sceneBookDisplay: sceneBookDisplayProp,
  sceneBookWidthMul = 1,
  sceneBookHeightMul = 1,
}: {
  shelfId: string;
  shelfAccent: string;
  books: SceneBook[];
  ornaments: SceneOrnament[];
  lightingPreset: string | null;
  /** Number of horizontal planks (2–5). */
  tierCount?: number;
  /** spine = narrow strip + title; cover = 2∶3 portrait, full cover image, no spine text. */
  sceneBookDisplay?: string | null;
  sceneBookWidthMul?: number;
  sceneBookHeightMul?: number;
  /** Tighter chrome for grid cells. */
  compact?: boolean;
  /** In a flex column, grow the canvas (e.g. full-screen library editor). */
  fillHeight?: boolean;
  /** Library wall on a small screen: short preview canvas; edit chrome lives in Expand / ⚙️. */
  wallCellNarrow?: boolean;
  scaleLayoutToExpandDesignWidth?: boolean;
  /** Visitor / preview: no editing, drag, or decor controls. */
  readOnly?: boolean;
  onLightingChange: (preset: string | null) => void;
  onCrossShelfBookDrop: (workId: string, fromShelfId: string, layout?: { xPct: number; yPct: number }) => void;
  onSceneSnap?: (shelfId: string, books: SceneBook[], ornaments: SceneOrnament[]) => void;
}) {
  const tierCount = Math.max(2, Math.min(5, Math.round(tierCountProp)));
  const bookDisplay: BookSceneDisplayMode = normalizeSceneBookDisplay(sceneBookDisplayProp);
  const bookWMul =
    typeof sceneBookWidthMul === "number" && Number.isFinite(sceneBookWidthMul) ? sceneBookWidthMul : 1;
  const bookHMul =
    typeof sceneBookHeightMul === "number" && Number.isFinite(sceneBookHeightMul) ? sceneBookHeightMul : 1;

  const sceneDefaultsRef = useRef({
    sceneBookDisplay: sceneBookDisplayProp,
    bookWMul,
    bookHMul,
  });
  sceneDefaultsRef.current = { sceneBookDisplay: sceneBookDisplayProp, bookWMul, bookHMul };

  function layoutForBook(b: SceneBook): { display: BookSceneDisplayMode; wMul: number; hMul: number } {
    const d = sceneDefaultsRef.current;
    const display = normalizeSceneBookDisplay(b.sceneDisplay ?? d.sceneBookDisplay);
    const wMul =
      typeof b.sceneWidthMul === "number" && Number.isFinite(b.sceneWidthMul) ? b.sceneWidthMul : d.bookWMul;
    const hMul =
      typeof b.sceneHeightMul === "number" && Number.isFinite(b.sceneHeightMul) ? b.sceneHeightMul : d.bookHMul;
    return { display, wMul, hMul };
  }

  /**
   * Narrow library wall: use the same min-height recipe as Expand (fillHeight) so scene height/width track
   * the viewport like the full editor — avoids a squat aspect-ratio preview that skews book % layout.
   */
  const canvasRef = useRef<HTMLDivElement>(null);
  const scaleHostRef = useRef<HTMLDivElement>(null);
  const scaleInnerRef = useRef<HTMLDivElement>(null);
  const layoutScaleRef = useRef(1);
  const scaleWallRef = useRef(false);
  scaleWallRef.current = scaleLayoutToExpandDesignWidth;

  const [layoutDesignWidthPx, setLayoutDesignWidthPx] = useState(680);
  const [layoutScale, setLayoutScale] = useState(1);

  const [sceneHeightPx, setSceneHeightPx] = useState(480);
  const booksRef = useRef(booksProp);
  const ornamentsRef = useRef(ornamentsProp);
  const [books, setBooks] = useState<SceneBook[]>(booksProp);
  const [ornaments, setOrnaments] = useState<SceneOrnament[]>(ornamentsProp);
  const [hoverState, setHoverState] = useState<{ rect: DOMRect; book: Work } | null>(null);
  const [draggingWorkId, setDraggingWorkId] = useState<string | null>(null);
  const [dragOverShelfIdx, setDragOverShelfIdx] = useState<number | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ornamentFileRef = useRef<HTMLInputElement>(null);

  type PointerCapture = { el: HTMLElement; id: number };

  const dragRef = useRef<
    | null
    | {
        type: "orn";
        id: string;
        grabOffsetXPx: number;
        grabOffsetYPx: number;
        pointerCapture: PointerCapture | null;
      }
    | {
        type: "book";
        workId: string;
        grabOffsetXPx: number;
        grabOffsetYPx: number;
        pointerCapture: PointerCapture | null;
      }
  >(null);

  const bookPendingRef = useRef<{
    workId: string;
    el: HTMLElement;
    startX: number;
    startY: number;
    pointerId: number;
    pointerCapture: PointerCapture | null;
  } | null>(null);

  const bookSaveRef = useRef<{ workId: string; layoutXPct: number; layoutYPct: number } | null>(null);
  const bookSceneSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [bookEditWorkId, setBookEditWorkId] = useState<string | null>(null);
  const bookEditWorkIdRef = useRef<string | null>(null);
  bookEditWorkIdRef.current = bookEditWorkId;

  const ornPendingRef = useRef<{
    id: string;
    el: HTMLElement;
    startX: number;
    startY: number;
    pointerId: number;
    pointerCapture: PointerCapture | null;
  } | null>(null);

  const [ornResizeId, setOrnResizeId] = useState<string | null>(null);
  const ornResizeIdRef = useRef<string | null>(null);
  ornResizeIdRef.current = ornResizeId;
  const ornScaleSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ornResizeRangeRef = useRef<HTMLInputElement>(null);

  const ornSaveRef = useRef<{ id: string; xPct: number; yPct: number } | null>(null);

  const booksPropRef = useRef(booksProp);
  booksPropRef.current = booksProp;
  /** Include layout so intra-shelf moves (same work ids) still sync from parent — fixes expand vs grid sharing stale props. */
  const booksLayoutSyncKey = useMemo(
    () =>
      [...booksProp]
        .map(
          (b) =>
            `${b.work.id}:${b.layoutXPct}:${b.layoutYPct}:${b.layoutZ}:${b.sortOrder}:${b.sceneDisplay ?? ""}:${b.sceneWidthMul ?? ""}:${b.sceneHeightMul ?? ""}`
        )
        .sort()
        .join("|"),
    [booksProp]
  );
  useEffect(() => {
    setBooks(booksPropRef.current);
  }, [shelfId, booksLayoutSyncKey]);

  const ornamentsSyncKey = useMemo(() => {
    const rows = [...ornamentsProp]
      .map((o) => [o.id, o.xPct, o.yPct, o.zIndex, o.scale, o.glyph, o.imageUrl ?? ""] as const)
      .sort((a, b) => a[0].localeCompare(b[0]));
    return JSON.stringify(rows);
  }, [ornamentsProp]);
  useEffect(() => {
    setOrnaments(ornamentsProp);
  }, [ornamentsProp, ornamentsSyncKey]);

  useEffect(() => {
    if (readOnly || !onSceneSnap) return;
    const t = window.setTimeout(() => {
      onSceneSnap(shelfId, books, ornaments);
    }, 100);
    return () => window.clearTimeout(t);
  }, [readOnly, shelfId, books, ornaments, onSceneSnap]);

  useEffect(() => {
    booksRef.current = books;
  }, [books]);

  useEffect(() => {
    ornamentsRef.current = ornaments;
  }, [ornaments]);

  useEffect(() => {
    if (!scaleLayoutToExpandDesignWidth) return;
    function sync() {
      if (typeof window === "undefined") return;
      setLayoutDesignWidthPx(Math.min(Math.max(320, window.innerWidth - 32), 680));
    }
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, [scaleLayoutToExpandDesignWidth]);

  useLayoutEffect(() => {
    if (!scaleLayoutToExpandDesignWidth) {
      layoutScaleRef.current = 1;
      setLayoutScale(1);
      return;
    }
    const host = scaleHostRef.current;
    if (!host) return;

    function measure() {
      const hEl = scaleHostRef.current;
      if (!hEl) return;
      const w = hEl.clientWidth;
      const d = layoutDesignWidthPx;
      const s = d > 0 ? Math.min(1, w / d) : 1;
      layoutScaleRef.current = s;
      setLayoutScale(s);
    }

    const ro = new ResizeObserver(measure);
    ro.observe(host);
    measure();
    return () => ro.disconnect();
  }, [scaleLayoutToExpandDesignWidth, layoutDesignWidthPx]);

  const plankBottoms = useMemo(
    () => computePlankBottomOffsetsPx(sceneHeightPx, tierCount),
    [sceneHeightPx, tierCount]
  );
  const plankBottomsRef = useRef(plankBottoms);
  plankBottomsRef.current = plankBottoms;
  const sceneHeightRef = useRef(sceneHeightPx);
  sceneHeightRef.current = sceneHeightPx;

  const backPanelTopPx = useMemo(() => {
    if (!plankBottoms.length) return 14;
    const c = clearanceAboveShelf(0, sceneHeightPx, plankBottoms);
    return Math.min(24, Math.max(10, Math.round(c * 0.08)));
  }, [plankBottoms, sceneHeightPx]);

  useLayoutEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const h = scaleLayoutToExpandDesignWidth ? el.offsetHeight : el.getBoundingClientRect().height;
    if (h >= 80) setSceneHeightPx(Math.round(h));
  }, [readOnly, compact, fillHeight, wallCellNarrow, tierCount, scaleLayoutToExpandDesignWidth, layoutDesignWidthPx]);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const h = entries[0]?.contentRect.height;
      if (h >= 80) setSceneHeightPx(Math.round(h));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [scaleLayoutToExpandDesignWidth]);

  const scheduleSaveBooks = useCallback(
    (next: SceneBook[]) => {
      if (readOnly) return;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        const order = buildOrderPayload(next);
        fetch(`/api/shelves/${shelfId}/books/reorder`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ order }),
        }).catch(() => null);
      }, 420);
    },
    [readOnly, shelfId]
  );

  const clampXPct = useCallback((centerX: number, halfW: number) => {
    const el = canvasRef.current;
    if (!el) return 50;
    const r = el.getBoundingClientRect();
    const s = scaleWallRef.current ? Math.max(layoutScaleRef.current, 0.0001) : 1;
    const layoutW = r.width / s;
    const cx = centerX - r.left;
    let xPct = (cx / r.width) * 100;
    const marginX = (halfW / layoutW) * 100;
    return Math.max(marginX + 1, Math.min(100 - marginX - 1, xPct));
  }, []);

  useEffect(() => {
    const root = canvasRef.current;
    if (!root) return;
    const blockSelect = (ev: Event) => ev.preventDefault();
    root.addEventListener("selectstart", blockSelect);
    return () => root.removeEventListener("selectstart", blockSelect);
  }, []);

  useEffect(() => {
    function lf(b: SceneBook) {
      const d = sceneDefaultsRef.current;
      const display = normalizeSceneBookDisplay(b.sceneDisplay ?? d.sceneBookDisplay);
      const wMul =
        typeof b.sceneWidthMul === "number" && Number.isFinite(b.sceneWidthMul) ? b.sceneWidthMul : d.bookWMul;
      const hMul =
        typeof b.sceneHeightMul === "number" && Number.isFinite(b.sceneHeightMul) ? b.sceneHeightMul : d.bookHMul;
      return { display, wMul, hMul };
    }
    function collisionWidthPx(workId: string, layoutYPct: number, list: SceneBook[]) {
      const sceneH = sceneHeightRef.current;
      const pb = plankBottomsRef.current;
      const ySnapped = snapLayoutYPctToShelfSurface(layoutYPct, sceneH, pb);
      const si = shelfIndexFromLayoutYPct(ySnapped, sceneH, pb);
      const clear = clearanceAboveShelf(si, sceneH, pb);
      const ob = list.find((x) => x.work.id === workId);
      const d = sceneDefaultsRef.current;
      const { display, wMul, hMul } = ob
        ? lf(ob)
        : {
            display: normalizeSceneBookDisplay(d.sceneBookDisplay),
            wMul: d.bookWMul,
            hMul: d.bookHMul,
          };
      return bookSceneDimensions(workId, clear, display, wMul, hMul).widthPx;
    }

    function onMove(e: PointerEvent) {
      const bookPending = bookPendingRef.current;
      if (bookPending && e.pointerId === bookPending.pointerId) {
        const dx = e.clientX - bookPending.startX;
        const dy = e.clientY - bookPending.startY;
        if (dx * dx + dy * dy <= BOOK_TAP_DRAG_THRESHOLD_PX * BOOK_TAP_DRAG_THRESHOLD_PX) {
          return;
        }
        const rect = bookPending.el.getBoundingClientRect();
        dragRef.current = {
          type: "book",
          workId: bookPending.workId,
          grabOffsetXPx: e.clientX - (rect.left + rect.width / 2),
          grabOffsetYPx: rect.bottom - e.clientY,
          pointerCapture: bookPending.pointerCapture,
        };
        bookPendingRef.current = null;
        setDraggingWorkId(bookPending.workId);
        setHoverState(null);
      }

      const pending = ornPendingRef.current;
      if (pending && e.pointerId === pending.pointerId) {
        const dx = e.clientX - pending.startX;
        const dy = e.clientY - pending.startY;
        if (dx * dx + dy * dy <= ORNAMENT_TAP_DRAG_THRESHOLD_PX * ORNAMENT_TAP_DRAG_THRESHOLD_PX) {
          return;
        }
        const rect = pending.el.getBoundingClientRect();
        dragRef.current = {
          type: "orn",
          id: pending.id,
          grabOffsetXPx: e.clientX - (rect.left + rect.width / 2),
          grabOffsetYPx: rect.bottom - e.clientY,
          pointerCapture: pending.pointerCapture,
        };
        ornPendingRef.current = null;
      }

      const d = dragRef.current;
      if (!d) return;

      if (d.type === "book") {
        const el = canvasRef.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        const s = scaleWallRef.current ? Math.max(layoutScaleRef.current, 0.0001) : 1;
        const layoutW = r.width / s;
        e.preventDefault();
        const b = booksRef.current.find((x) => x.work.id === d.workId);
        if (!b) return;
        const sceneH = sceneHeightRef.current;
        const pb = plankBottomsRef.current;
        const bottom = e.clientY + d.grabOffsetYPx;
        const pxFromBottom = (r.bottom - bottom) / s;
        const yPct = snapBottomToPct(pxFromBottom, sceneH, pb);
        setDragOverShelfIdx(nearestPlankIndex(pxFromBottom, pb));
        const si = nearestPlankIndex(pxFromBottom, pb);
        const clear = clearanceAboveShelf(si, sceneH, pb);
        const { display, wMul, hMul } = lf(b);
        const dims = bookSceneDimensions(b.work.id, clear, display, wMul, hMul);
        const list = booksRef.current;
        const centerX = e.clientX - d.grabOffsetXPx;
        let xPct = clampXPct(centerX, dims.widthPx / 2);
        xPct = resolveBookCenterXPctNoOverlap(
          xPct,
          b.work.id,
          yPct,
          dims.widthPx,
          layoutW,
          list,
          sceneH,
          pb,
          (workId, ly) => collisionWidthPx(workId, ly, list)
        );
        bookSaveRef.current = { workId: d.workId, layoutXPct: xPct, layoutYPct: yPct };
        setBooks((prev) =>
          prev.map((book) =>
            book.work.id === d.workId ? { ...book, layoutXPct: xPct, layoutYPct: yPct, layoutZ: 5 } : book
          )
        );
        return;
      }

      if (d.type !== "orn") return;
      const el = canvasRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const s = scaleWallRef.current ? Math.max(layoutScaleRef.current, 0.0001) : 1;
      e.preventDefault();
      const o = ornamentsRef.current.find((x) => x.id === d.id);
      if (!o) return;
      const sceneH = sceneHeightRef.current;
      const pb = plankBottomsRef.current;
      const si = shelfIndexFromLayoutYPct(o.yPct, sceneH, pb);
      const clear = clearanceAboveShelf(si, sceneH, pb);
      const basePx = ornamentEmblemBasePx(clear);
      const size = basePx * o.scale;
      const centerX = e.clientX - d.grabOffsetXPx;
      const bottom = e.clientY + d.grabOffsetYPx;
      const pxFromBottom = (r.bottom - bottom) / s;
      const yPct = snapBottomToPct(pxFromBottom, sceneH, plankBottomsRef.current);
      const xPct = clampXPct(centerX, size / 2);
      ornSaveRef.current = { id: d.id, xPct, yPct };
      setOrnaments((prev) => prev.map((x) => (x.id === d.id ? { ...x, xPct, yPct } : x)));
    }

    function onUp(e: PointerEvent) {
      const bPending = bookPendingRef.current;
      if (bPending && e.pointerId === bPending.pointerId) {
        if (bPending.pointerCapture) {
          try {
            bPending.pointerCapture.el.releasePointerCapture(e.pointerId);
          } catch {
            /* ignore */
          }
        }
        bookPendingRef.current = null;
        if (e.type === "pointercancel") return;
        if (!readOnly) {
          setBookEditWorkId(bPending.workId);
        }
        return;
      }

      const pending = ornPendingRef.current;
      if (pending && e.pointerId === pending.pointerId) {
        if (pending.pointerCapture) {
          try {
            pending.pointerCapture.el.releasePointerCapture(e.pointerId);
          } catch {
            /* ignore */
          }
        }
        ornPendingRef.current = null;
        if (e.type === "pointercancel") return;
        if (e.shiftKey) {
          void fetch(`/api/shelves/${shelfId}/ornaments/${pending.id}`, { method: "DELETE" }).catch(() => null);
          setOrnaments((prev) => prev.filter((x) => x.id !== pending.id));
        } else {
          setOrnResizeId(pending.id);
        }
        return;
      }

      const d = dragRef.current;
      if (d?.pointerCapture && d.pointerCapture.id === e.pointerId) {
        try {
          d.pointerCapture.el.releasePointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
      }
      dragRef.current = null;

      if (d?.type === "book") {
        setDraggingWorkId(null);
        setDragOverShelfIdx(null);
        const saved = bookSaveRef.current;
        bookSaveRef.current = null;
        if (!saved || saved.workId !== d.workId) return;
        const movingBook = booksRef.current.find((bk) => bk.work.id === d.workId);
        if (!movingBook) return;

        const elAt = document.elementFromPoint(e.clientX, e.clientY);
        const target = elAt?.closest("[data-shelf-scene-id]") as HTMLElement | null;
        const targetShelfId = target?.getAttribute("data-shelf-scene-id") ?? null;

        if (targetShelfId && targetShelfId !== shelfId && target) {
          const tTiers = Math.max(2, Math.min(5, parseInt(target.dataset.shelfSceneTiers ?? "3", 10) || 3));
          const r = target.getBoundingClientRect();
          const targetScale = parseFloat(target.dataset.shelfSceneLayoutScale ?? "1") || 1;
          const ts = Math.max(targetScale, 0.0001);
          const layoutW = r.width / ts;
          const layoutH = r.height / ts;
          const targetSceneH = Math.max(80, Math.round(layoutH));
          const targetPlanks = computePlankBottomOffsetsPx(targetSceneH, tTiers);
          const pxFromBottom = (r.bottom - e.clientY) / ts;
          const yPct = snapBottomToPct(pxFromBottom, targetSceneH, targetPlanks);
          const si = nearestPlankIndex(pxFromBottom, targetPlanks);
          const clear = clearanceAboveShelf(si, targetSceneH, targetPlanks);
          const { display, wMul, hMul } = lf(movingBook);
          const dims = bookSceneDimensions(d.workId, clear, display, wMul, hMul);
          const marginX = (dims.widthPx / layoutW) * 100 / 2;
          let xPct = ((e.clientX - r.left) / r.width) * 100;
          xPct = Math.max(marginX + 1, Math.min(100 - marginX - 1, xPct));

          onCrossShelfBookDrop(d.workId, shelfId, { xPct, yPct });
          setBooks((prev) => prev.filter((bk) => bk.work.id !== d.workId));
          return;
        }

        setBooks((prev) => {
          const next = prev.map((bk) =>
            bk.work.id === d.workId
              ? { ...bk, layoutXPct: saved.layoutXPct, layoutYPct: saved.layoutYPct, layoutZ: 5 }
              : bk
          );
          scheduleSaveBooks(next);
          return next;
        });
        return;
      }

      if (!d || d.type !== "orn") return;
      const pos = ornSaveRef.current;
      ornSaveRef.current = null;
      if (pos && pos.id === d.id) {
        fetch(`/api/shelves/${shelfId}/ornaments/${d.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ xPct: pos.xPct, yPct: pos.yPct }),
        }).catch(() => null);
      }
    }
    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [clampXPct, onCrossShelfBookDrop, readOnly, scheduleSaveBooks, shelfId, tierCount]);

  function onOrnamentPointerDown(e: React.PointerEvent, o: SceneOrnament) {
    if (readOnly) return;
    if (!e.isPrimary) return;
    e.preventDefault();
    e.stopPropagation();
    setHoverState(null);
    const el = e.currentTarget as HTMLElement;
    let pointerCapture: PointerCapture | null = null;
    try {
      el.setPointerCapture(e.pointerId);
      pointerCapture = { el, id: e.pointerId };
    } catch {
      /* ignore */
    }
    ornPendingRef.current = {
      id: o.id,
      el,
      startX: e.clientX,
      startY: e.clientY,
      pointerId: e.pointerId,
      pointerCapture,
    };
  }

  const scheduleOrnScalePatch = useCallback(
    (ornId: string, scale: number) => {
      if (readOnly) return;
      if (ornScaleSaveTimer.current) clearTimeout(ornScaleSaveTimer.current);
      ornScaleSaveTimer.current = setTimeout(() => {
        ornScaleSaveTimer.current = null;
        fetch(`/api/shelves/${shelfId}/ornaments/${ornId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scale }),
        }).catch(() => null);
      }, 400);
    },
    [readOnly, shelfId]
  );

  const closeOrnResize = useCallback(() => {
    if (ornScaleSaveTimer.current) {
      clearTimeout(ornScaleSaveTimer.current);
      ornScaleSaveTimer.current = null;
    }
    const id = ornResizeIdRef.current;
    setOrnResizeId(null);
    if (!readOnly && id) {
      const o = ornamentsRef.current.find((x) => x.id === id);
      if (o) {
        fetch(`/api/shelves/${shelfId}/ornaments/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scale: o.scale }),
        }).catch(() => null);
      }
    }
  }, [readOnly, shelfId]);

  useLayoutEffect(() => {
    if (ornResizeId) ornResizeRangeRef.current?.focus();
  }, [ornResizeId]);

  useEffect(() => {
    if (!ornResizeId) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeOrnResize();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ornResizeId, closeOrnResize]);

  useEffect(() => {
    if (!ornResizeId) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [ornResizeId]);

  useEffect(() => {
    if (ornResizeId && !ornaments.some((x) => x.id === ornResizeId)) {
      if (ornScaleSaveTimer.current) {
        clearTimeout(ornScaleSaveTimer.current);
        ornScaleSaveTimer.current = null;
      }
      setOrnResizeId(null);
    }
  }, [ornResizeId, ornaments]);

  function onBookPointerDown(e: React.PointerEvent, b: SceneBook) {
    if (readOnly) return;
    if (!e.isPrimary) return;
    e.preventDefault();
    e.stopPropagation();
    setHoverState(null);
    const el = e.currentTarget as HTMLElement;
    let pointerCapture: PointerCapture | null = null;
    try {
      el.setPointerCapture(e.pointerId);
      pointerCapture = { el, id: e.pointerId };
    } catch {
      /* ignore */
    }
    bookPendingRef.current = {
      workId: b.work.id,
      el,
      startX: e.clientX,
      startY: e.clientY,
      pointerId: e.pointerId,
      pointerCapture,
    };
  }

  const scheduleBookScenePatch = useCallback(
    (
      workId: string,
      patch: {
        sceneDisplay?: "spine" | "cover" | null;
        sceneWidthMul?: number | null;
        sceneHeightMul?: number | null;
      }
    ) => {
      if (readOnly) return;
      if (bookSceneSaveTimer.current) clearTimeout(bookSceneSaveTimer.current);
      bookSceneSaveTimer.current = setTimeout(() => {
        bookSceneSaveTimer.current = null;
        fetch(`/api/shelves/${shelfId}/books/${workId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        }).catch(() => null);
      }, 400);
    },
    [readOnly, shelfId]
  );

  const closeBookEdit = useCallback(() => {
    if (bookSceneSaveTimer.current) {
      clearTimeout(bookSceneSaveTimer.current);
      bookSceneSaveTimer.current = null;
    }
    const wid = bookEditWorkIdRef.current;
    setBookEditWorkId(null);
    if (!readOnly && wid) {
      const b = booksRef.current.find((x) => x.work.id === wid);
      if (b) {
        fetch(`/api/shelves/${shelfId}/books/${wid}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sceneDisplay: b.sceneDisplay ?? null,
            sceneWidthMul: b.sceneWidthMul ?? null,
            sceneHeightMul: b.sceneHeightMul ?? null,
          }),
        }).catch(() => null);
      }
    }
  }, [readOnly, shelfId]);

  useEffect(() => {
    if (!bookEditWorkId) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeBookEdit();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [bookEditWorkId, closeBookEdit]);

  useEffect(() => {
    if (!bookEditWorkId) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [bookEditWorkId]);

  useEffect(() => {
    if (bookEditWorkId && !books.some((x) => x.work.id === bookEditWorkId)) {
      if (bookSceneSaveTimer.current) {
        clearTimeout(bookSceneSaveTimer.current);
        bookSceneSaveTimer.current = null;
      }
      setBookEditWorkId(null);
    }
  }, [bookEditWorkId, books]);

  function defaultOrnamentYPct(): number {
    const midIdx = Math.max(0, Math.floor((plankBottoms.length - 1) / 2));
    const midSurface = surfacePxFromBottom(plankBottoms[midIdx] ?? 0);
    return (midSurface / Math.max(1, sceneHeightPx)) * 100;
  }

  async function addOrnament(glyph: string) {
    if (readOnly) return;
    const yPct = defaultOrnamentYPct();
    const res = await fetch(`/api/shelves/${shelfId}/ornaments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ glyph, xPct: 50, yPct, zIndex: 34, scale: 1 }),
    });
    if (!res.ok) return;
    const created = (await res.json()) as SceneOrnament;
    setOrnaments((prev) => [...prev, created]);
  }

  async function addOrnamentImage(dataUrl: string) {
    if (readOnly) return;
    const err = validateOrnamentDataImageUrl(dataUrl);
    if (err) {
      window.alert(err);
      return;
    }
    const yPct = defaultOrnamentYPct();
    const res = await fetch(`/api/shelves/${shelfId}/ornaments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        glyph: "",
        imageUrl: dataUrl,
        xPct: 50,
        yPct,
        zIndex: 34,
        scale: 1,
      }),
    });
    if (!res.ok) {
      const j = (await res.json().catch(() => null)) as { error?: string } | null;
      window.alert(j?.error ?? "Could not add image");
      return;
    }
    const created = (await res.json()) as SceneOrnament;
    setOrnaments((prev) => [...prev, created]);
  }

  function onOrnamentImageSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      window.alert("Choose a PNG, JPEG, GIF, or WebP image.");
      return;
    }
    if (file.size > 200 * 1024) {
      window.alert("Image must be 200KB or smaller.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : null;
      if (dataUrl) void addOrnamentImage(dataUrl);
    };
    reader.readAsDataURL(file);
  }

  const lit = lightingStyle(lightingPreset, shelfAccent);

  /** Expand + library wall (fillHeight) share one min-height so layout % / book px match everywhere. */
  const canvasMinHeight = useMemo(() => {
    if (fillHeight) {
      return readOnly
        ? "min(52dvh, min(100vw - 32px, 640px))"
        : "min(58dvh, min(100vw - 32px, 680px))";
    }
    if (compact) {
      return readOnly
        ? "clamp(300px, 58svh, 580px)"
        : "clamp(280px, 52svh, 540px)";
    }
    return 320;
  }, [fillHeight, compact, readOnly]);

  const ornResizeTarget = ornResizeId ? ornaments.find((o) => o.id === ornResizeId) : undefined;
  const bookEditTarget = bookEditWorkId ? books.find((b) => b.work.id === bookEditWorkId) : undefined;

  const scaleHostStyle = useMemo((): React.CSSProperties => {
    const base: React.CSSProperties = {
      width: "100%",
      flex: fillHeight ? 1 : undefined,
      minHeight: 0,
      display: "flex",
      flexDirection: "column",
    };
    if (!scaleLayoutToExpandDesignWidth) return base;
    return { ...base, overflowX: "hidden" };
  }, [fillHeight, scaleLayoutToExpandDesignWidth]);

  const scaleInnerStyle = useMemo((): React.CSSProperties => {
    const base: React.CSSProperties = {
      display: "flex",
      flexDirection: "column",
      flex: fillHeight ? 1 : undefined,
      minHeight: 0,
      width: "100%",
      boxSizing: "border-box",
    };
    if (!scaleLayoutToExpandDesignWidth) return base;
    return {
      ...base,
      width: layoutDesignWidthPx,
      transform: `scale(${layoutScale})`,
      transformOrigin: "top left",
    };
  }, [fillHeight, layoutDesignWidthPx, layoutScale, scaleLayoutToExpandDesignWidth]);

  return (
    <div
      style={{
        padding: wallCellNarrow && compact ? "4px 0 6px" : compact ? "6px 0 10px" : "12px 0 20px",
        display: "flex",
        flexDirection: "column",
        flex: compact || fillHeight ? 1 : undefined,
        minHeight: compact || fillHeight ? 0 : undefined,
        width: "100%",
        maxWidth: "100%",
        minWidth: 0,
        boxSizing: "border-box",
      }}
    >
      {!readOnly && !wallCellNarrow && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: compact ? 6 : 10,
            marginBottom: compact ? 8 : 12,
            paddingLeft: compact ? 2 : 4,
          }}
        >
          <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Lighting
          </span>
          {LIGHTING_PRESETS.map((p) => {
            const active = (p.id === "none" && !lightingPreset) || lightingPreset === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  const next = p.id === "none" ? null : p.id;
                  onLightingChange(next);
                  fetch(`/api/shelves/${shelfId}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ lightingPreset: next ?? "none" }),
                  }).catch(() => null);
                }}
                style={{
                  fontSize: compact ? 11 : 13,
                  padding: compact ? "4px 10px" : "10px 14px",
                  minHeight: compact ? undefined : 44,
                  borderRadius: 8,
                  border: `1px solid ${active ? shelfAccent : "var(--border)"}`,
                  background: active ? `${shelfAccent}22` : "var(--bg)",
                  color: active ? shelfAccent : "var(--muted)",
                  fontWeight: active ? 600 : 500,
                  cursor: "pointer",
                }}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      )}

      {!readOnly && !wallCellNarrow && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", marginBottom: 10, paddingLeft: 4 }}>
          <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600, marginRight: 4 }}>Decor</span>
          <input
            ref={ornamentFileRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
            style={{ display: "none" }}
            onChange={onOrnamentImageSelected}
          />
          <button
            type="button"
            title="Add a small image (max ~200KB)"
            onClick={() => ornamentFileRef.current?.click()}
            style={{
              fontSize: compact ? 11 : 13,
              fontWeight: 600,
              padding: compact ? "4px 10px" : "10px 14px",
              minHeight: compact ? undefined : 44,
              borderRadius: 8,
              border: `1px solid ${shelfAccent}55`,
              background: `${shelfAccent}14`,
              color: shelfAccent,
              cursor: "pointer",
            }}
          >
            Upload image
          </button>
          {ORNAMENT_PICKS.map((g) => (
            <button
              key={g}
              type="button"
              title="Add to shelf"
              onClick={() => addOrnament(g)}
              style={{
                fontSize: compact ? 20 : 22,
                lineHeight: 1,
                padding: compact ? "4px 6px" : "8px 10px",
                minWidth: compact ? undefined : 44,
                minHeight: compact ? undefined : 44,
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "var(--surface)",
                cursor: "pointer",
              }}
            >
              {g}
            </button>
          ))}
          <span style={{ fontSize: 10, color: "var(--muted)", marginLeft: 8 }}>
            Emoji or image · drag to place · tap decor to resize · shift+tap to remove · tap books for display & size
          </span>
        </div>
      )}

      <div ref={scaleHostRef} style={scaleHostStyle}>
        <div ref={scaleInnerRef} style={scaleInnerStyle}>
          <div
            ref={canvasRef}
            className="shelf-scene-canvas"
            data-shelf-scene-id={shelfId}
            data-shelf-scene-tiers={tierCount}
            data-shelf-scene-layout-scale={scaleLayoutToExpandDesignWidth ? String(layoutScale) : "1"}
            style={{
              position: "relative",
              flex: fillHeight ? 1 : undefined,
              minHeight: canvasMinHeight as number | string,
              maxWidth: "100%",
              width: "100%",
              boxSizing: "border-box",
              touchAction: readOnly ? undefined : "none",
              background: "linear-gradient(to bottom, rgba(0,0,0,0.08) 0%, transparent 28%)",
              borderRadius: "0 0 12px 12px",
              border: "1px solid rgba(0,0,0,0.12)",
              isolation: "isolate",
            }}
          >
        {/*
          Lighting filters on the same layer as draggable items cause Chrome/WebKit compositor smears (“trails”)
          when ornaments move. Keep filter + inset glow on this static, pointer-events: none shell only.
        */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "inherit",
            overflow: "hidden",
            zIndex: 0,
            pointerEvents: "none",
            ...lit,
            background: "linear-gradient(to bottom, rgba(0,0,0,0.06) 0%, transparent 26%)",
          }}
        >
          {/* Back panel — ties planks into one cabinet */}
          <div
            style={{
              position: "absolute",
              left: PLANK_INSET,
              right: PLANK_INSET,
              bottom: plankBottoms[0] ?? 12,
              top: backPanelTopPx,
              borderRadius: 10,
              background: "linear-gradient(180deg, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0.42) 100%)",
              boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.04)",
              zIndex: 0,
              pointerEvents: "none",
            }}
          />

          <ShelfLightString preset={lightingPreset} shelfAccent={shelfAccent} />

          {books.length === 0 && (
            <div
              style={{
                position: "absolute",
                inset: 16,
                border: `2px dashed ${shelfAccent}55`,
                borderRadius: 12,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--muted)",
                fontSize: 13,
                pointerEvents: "none",
                zIndex: 1,
              }}
            >
              {readOnly
                ? "No books on this shelf yet."
                : wallCellNarrow
                  ? "Add books from search — drag or tap books (preview matches Expand height)"
                  : "Drag books to move along shelves; tap a book for spine/cover & size"}
            </div>
          )}

          {plankBottoms.map((bottomPx, i) => {
            const hot = dragOverShelfIdx === i;
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: PLANK_INSET,
                  right: PLANK_INSET,
                  height: PLANK_HEIGHT,
                  bottom: bottomPx,
                  borderRadius: 3,
                  background: hot
                    ? `linear-gradient(to bottom, ${shelfAccent}99, ${shelfAccent}dd)`
                    : `linear-gradient(to bottom, ${shelfAccent}66, ${shelfAccent}bb)`,
                  boxShadow: hot
                    ? `0 0 0 2px ${shelfAccent}, 0 6px 16px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.2)`
                    : `0 4px 12px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.14)`,
                  pointerEvents: "none",
                  zIndex: 2 + i,
                  transition: "box-shadow 0.15s ease, background 0.15s ease",
                }}
              />
            );
          })}
        </div>

        {books.map((b) => {
          const colour = spineColour(b.work.title, 0);
          const bottomPct = snapLayoutYPctToShelfSurface(b.layoutYPct, sceneHeightPx, plankBottoms);
          const si = shelfIndexFromLayoutYPct(bottomPct, sceneHeightPx, plankBottoms);
          const clear = clearanceAboveShelf(si, sceneHeightPx, plankBottoms);
          const { display: bDisp, wMul: bWMul, hMul: bHMul } = layoutForBook(b);
          const { widthPx, heightPx } = bookSceneDimensions(b.work.id, clear, bDisp, bWMul, bHMul);
          const isDragging = draggingWorkId === b.work.id;
          const isCover = bDisp === "cover";
          return (
            <div
              key={b.work.id}
              data-workid={b.work.id}
              className="shelf-book-spine"
              onPointerDown={readOnly ? undefined : (e) => onBookPointerDown(e, b)}
              onMouseEnter={(e) => {
                if (draggingWorkId) return;
                const el = e.currentTarget as HTMLElement;
                el.style.transform = readOnly ? "translateX(-50%)" : "translateX(-50%) translateY(-5px)";
                setHoverState({ rect: el.getBoundingClientRect(), book: b.work });
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.transform = "translateX(-50%)";
                setHoverState(null);
              }}
              style={{
                position: "absolute",
                left: `${b.layoutXPct}%`,
                bottom: `${bottomPct}%`,
                transform: "translateX(-50%)",
                width: widthPx,
                height: heightPx,
                zIndex: b.layoutZ,
                borderRadius: isCover ? 6 : "2px 4px 4px 2px",
                overflow: "hidden",
                boxShadow: isDragging ? "none" : "1px 3px 8px rgba(0,0,0,0.32)",
                cursor: readOnly ? "default" : "grab",
                touchAction: readOnly ? undefined : "none",
                userSelect: "none",
                background: colour,
                opacity: isDragging ? 0.35 : 1,
                transition: isDragging
                  ? "opacity 0.12s ease"
                  : "opacity 0.12s ease, bottom 0.2s cubic-bezier(0.4, 0, 0.2, 1), left 0.2s cubic-bezier(0.4, 0, 0.2, 1), transform 0.12s ease, box-shadow 0.12s ease",
              }}
            >
              {b.work.coverUrl ? (
                <img
                  src={b.work.coverUrl}
                  alt=""
                  draggable={false}
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    pointerEvents: "none",
                  }}
                />
              ) : null}
              {isCover ? (
                !b.work.coverUrl ? (
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: 6,
                      pointerEvents: "none",
                    }}
                  >
                    <span
                      style={{
                        fontSize: Math.max(8, Math.min(12, Math.round(widthPx / 7))),
                        fontWeight: 700,
                        color: "#fff",
                        textAlign: "center",
                        lineHeight: 1.2,
                        overflow: "hidden",
                        display: "-webkit-box",
                        WebkitLineClamp: 4,
                        WebkitBoxOrient: "vertical",
                        textShadow: "0 1px 3px rgba(0,0,0,0.75)",
                      }}
                    >
                      {b.work.title}
                    </span>
                  </div>
                ) : null
              ) : (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "4px 2px",
                    background: "linear-gradient(to right, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.12) 55%, transparent 100%)",
                    pointerEvents: "none",
                  }}
                >
                  <span
                    style={{
                      writingMode: "vertical-rl",
                      textOrientation: "mixed",
                      transform: "rotate(180deg)",
                      fontSize: 7,
                      fontWeight: 700,
                      color: "#fff",
                      lineHeight: 1.1,
                      overflow: "hidden",
                      maxHeight: "90%",
                      textShadow: "0 0 2px #000",
                    }}
                  >
                    {b.work.title.slice(0, 26)}
                  </span>
                </div>
              )}
              {(() => {
                const rp = b.work.readingProgressPercent;
                if (rp == null || !Number.isFinite(rp)) return null;
                const pct = Math.min(100, Math.max(0, rp));
                return (
                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      right: 0,
                      bottom: 0,
                      height: 3,
                      background: "rgba(0,0,0,0.28)",
                      pointerEvents: "none",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${pct}%`,
                        background: shelfAccent,
                        borderRadius: "0 0 0 1px",
                      }}
                    />
                  </div>
                );
              })()}
            </div>
          );
        })}

        {ornaments.map((o) => {
          /** Same as book spines: re-snap to nearest shelf surface for this scene height so stored % stays aligned across viewports. */
          const bottomPctResolved = snapLayoutYPctToShelfSurface(o.yPct, sceneHeightPx, plankBottoms);
          const ornSi = shelfIndexFromLayoutYPct(bottomPctResolved, sceneHeightPx, plankBottoms);
          const ornClear = clearanceAboveShelf(ornSi, sceneHeightPx, plankBottoms);
          const basePx = ornamentEmblemBasePx(ornClear);
          return (
            <div
              key={o.id}
              onPointerDown={readOnly ? undefined : (e) => onOrnamentPointerDown(e, o)}
              style={{
                position: "absolute",
                left: `${o.xPct}%`,
                bottom: `${bottomPctResolved}%`,
                transform: `translateX(-50%) scale(${o.scale})`,
                transformOrigin: "center bottom",
                zIndex: o.zIndex,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "fit-content",
                height: "fit-content",
                lineHeight: 1,
                cursor: readOnly ? "default" : "grab",
                touchAction: readOnly ? undefined : "none",
                userSelect: "none",
                background: "transparent",
              }}
              title={
                readOnly
                  ? undefined
                  : "Tap to resize · drag to move · shift+tap to remove"
              }
            >
              {o.imageUrl ? (
                <img
                  src={o.imageUrl}
                  alt=""
                  draggable={false}
                  style={{
                    maxWidth: basePx,
                    maxHeight: basePx,
                    width: "auto",
                    height: "auto",
                    objectFit: "contain",
                    pointerEvents: "none",
                    display: "block",
                  }}
                />
              ) : (
                <span style={{ fontSize: basePx, lineHeight: 1, display: "block" }}>{o.glyph}</span>
              )}
            </div>
          );
        })}
          </div>
        </div>
      </div>

      {!readOnly && !wallCellNarrow && (
        <p style={{ fontSize: 11, color: "var(--muted)", margin: "10px 4px 0", lineHeight: 1.45 }}>
          Drag a book to reposition or move to another shelf; tap for spine vs cover and size. Decor uses the same shelf lines.{" "}
          <Link href="/search" style={{ color: shelfAccent, textDecoration: "none", fontWeight: 500 }}>
            Add books
          </Link>
        </p>
      )}

      {hoverState && !draggingWorkId && (
        <BookSpineHoverCard
          anchorRect={hoverState.rect}
          book={{
            title: hoverState.book.title,
            coverUrl: hoverState.book.coverUrl,
            averageRating: hoverState.book.averageRating,
            ratingsCount: hoverState.book.ratingsCount,
            communityRatingAvg: hoverState.book.communityRatingAvg,
            communityReviewCount: hoverState.book.communityReviewCount,
            recommendationsReceivedCount: hoverState.book.recommendationsReceivedCount,
            authors: hoverState.book.workAuthors.map((wa) => wa.author.name),
          }}
        />
      )}

      {ornResizeTarget && !readOnly && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 4550,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            padding: 0,
            paddingBottom: "env(safe-area-inset-bottom)",
            boxSizing: "border-box",
            pointerEvents: "none",
          }}
        >
          <div
            role="presentation"
            aria-hidden
            onClick={closeOrnResize}
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0,0,0,0.42)",
              pointerEvents: "auto",
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="orn-resize-title"
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "relative",
              zIndex: 1,
              width: "100%",
              maxWidth: 480,
              maxHeight: "min(42vh, 380px)",
              overflow: "auto",
              padding: "18px 18px 16px",
              borderRadius: "14px 14px 0 0",
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderBottom: "none",
              boxShadow: "0 -8px 40px rgba(0,0,0,0.28)",
              boxSizing: "border-box",
              pointerEvents: "auto",
            }}
          >
            <h2
              id="orn-resize-title"
              style={{
                margin: "0 0 14px",
                fontSize: 16,
                fontWeight: 700,
                color: "var(--foreground)",
              }}
            >
              Decor size
            </h2>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <input
                ref={ornResizeRangeRef}
                type="range"
                min={ORNAMENT_SCALE_MIN}
                max={ORNAMENT_SCALE_MAX}
                step={ORNAMENT_SCALE_STEP}
                value={Math.min(
                  ORNAMENT_SCALE_MAX,
                  Math.max(ORNAMENT_SCALE_MIN, ornResizeTarget.scale)
                )}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  setOrnaments((prev) =>
                    prev.map((x) => (x.id === ornResizeTarget.id ? { ...x, scale: v } : x))
                  );
                  scheduleOrnScalePatch(ornResizeTarget.id, v);
                }}
                style={{ flex: 1, minWidth: 0, accentColor: shelfAccent }}
              />
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--muted)",
                  minWidth: 46,
                  textAlign: "right",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {Math.round(ornResizeTarget.scale * 100)}%
              </span>
            </div>
            <button
              type="button"
              onClick={closeOrnResize}
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: 10,
                border: `1px solid ${shelfAccent}88`,
                background: `${shelfAccent}22`,
                color: shelfAccent,
                fontWeight: 600,
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              Done
            </button>
          </div>
        </div>
      )}

      {bookEditTarget && !readOnly && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 4548,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            padding: 0,
            paddingBottom: "env(safe-area-inset-bottom)",
            boxSizing: "border-box",
            pointerEvents: "none",
          }}
        >
          <div
            role="presentation"
            aria-hidden
            onClick={closeBookEdit}
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0,0,0,0.42)",
              pointerEvents: "auto",
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="book-scene-edit-title"
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "relative",
              zIndex: 1,
              width: "100%",
              maxWidth: 480,
              maxHeight: "min(55vh, 480px)",
              overflow: "auto",
              padding: "18px 18px 12px",
              borderRadius: "14px 14px 0 0",
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderBottom: "none",
              boxShadow: "0 -8px 40px rgba(0,0,0,0.28)",
              boxSizing: "border-box",
              pointerEvents: "auto",
            }}
          >
            <h2
              id="book-scene-edit-title"
              style={{
                margin: "0 0 6px",
                fontSize: 16,
                fontWeight: 700,
                color: "var(--foreground)",
                lineHeight: 1.3,
              }}
            >
              Book on shelf
            </h2>
            <p
              style={{
                margin: "0 0 14px",
                fontSize: 12,
                color: "var(--muted)",
                lineHeight: 1.4,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {bookEditTarget.work.title}
            </p>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", marginBottom: 8 }}>Display</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              {(["spine", "cover"] as const).map((mode) => {
                const active = layoutForBook(bookEditTarget).display === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => {
                      const wid = bookEditTarget.work.id;
                      setBooks((prev) =>
                        prev.map((bk) => (bk.work.id === wid ? { ...bk, sceneDisplay: mode } : bk))
                      );
                      scheduleBookScenePatch(wid, { sceneDisplay: mode });
                    }}
                    style={{
                      flex: 1,
                      padding: "8px 10px",
                      borderRadius: 8,
                      border: `1px solid ${active ? shelfAccent : "var(--border)"}`,
                      background: active ? `${shelfAccent}18` : "var(--bg)",
                      color: active ? shelfAccent : "var(--muted)",
                      fontWeight: 600,
                      fontSize: 13,
                      cursor: "pointer",
                    }}
                  >
                    {mode === "spine" ? "Spine" : "Cover"}
                  </button>
                );
              })}
            </div>
            <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 6 }}>Size (width × height)</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <label style={{ fontSize: 11, color: "var(--muted)", display: "block" }}>
                Width{" "}
                {(typeof bookEditTarget.sceneWidthMul === "number" ? bookEditTarget.sceneWidthMul : bookWMul).toFixed(2)}
                ×
                <input
                  type="range"
                  min={0.35}
                  max={2}
                  step={0.05}
                  value={
                    typeof bookEditTarget.sceneWidthMul === "number" ? bookEditTarget.sceneWidthMul : bookWMul
                  }
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    const wid = bookEditTarget.work.id;
                    setBooks((prev) =>
                      prev.map((bk) => (bk.work.id === wid ? { ...bk, sceneWidthMul: v } : bk))
                    );
                    scheduleBookScenePatch(wid, { sceneWidthMul: v });
                  }}
                  style={{ display: "block", width: "100%", marginTop: 6, accentColor: shelfAccent }}
                />
              </label>
              <label style={{ fontSize: 11, color: "var(--muted)", display: "block" }}>
                Height{" "}
                {(typeof bookEditTarget.sceneHeightMul === "number" ? bookEditTarget.sceneHeightMul : bookHMul).toFixed(2)}
                ×
                <input
                  type="range"
                  min={0.35}
                  max={2}
                  step={0.05}
                  value={
                    typeof bookEditTarget.sceneHeightMul === "number" ? bookEditTarget.sceneHeightMul : bookHMul
                  }
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    const wid = bookEditTarget.work.id;
                    setBooks((prev) =>
                      prev.map((bk) => (bk.work.id === wid ? { ...bk, sceneHeightMul: v } : bk))
                    );
                    scheduleBookScenePatch(wid, { sceneHeightMul: v });
                  }}
                  style={{ display: "block", width: "100%", marginTop: 6, accentColor: shelfAccent }}
                />
              </label>
            </div>
            <button
              type="button"
              onClick={() => {
                const wid = bookEditTarget.work.id;
                setBooks((prev) =>
                  prev.map((bk) =>
                    bk.work.id === wid
                      ? { ...bk, sceneDisplay: null, sceneWidthMul: null, sceneHeightMul: null }
                      : bk
                  )
                );
                if (bookSceneSaveTimer.current) {
                  clearTimeout(bookSceneSaveTimer.current);
                  bookSceneSaveTimer.current = null;
                }
                void fetch(`/api/shelves/${shelfId}/books/${wid}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    sceneDisplay: null,
                    sceneWidthMul: null,
                    sceneHeightMul: null,
                  }),
                }).catch(() => null);
              }}
              style={{
                width: "100%",
                marginBottom: 10,
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "var(--bg)",
                color: "var(--muted)",
                fontWeight: 600,
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              Use shelf defaults
            </button>
            <button
              type="button"
              onClick={closeBookEdit}
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: 10,
                border: `1px solid ${shelfAccent}88`,
                background: `${shelfAccent}22`,
                color: shelfAccent,
                fontWeight: 600,
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
