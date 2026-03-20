"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
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
import { setShelfDragPayload, type BookDragPayload } from "./shelfDragState";

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
  workAuthors: { author: Author }[];
}

export interface SceneBook {
  work: Work;
  sortOrder: number;
  layoutXPct: number;
  layoutYPct: number;
  layoutZ: number;
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

const FAIRY_BULB_COUNT = 18;

/** Spine size: per-book height variety, capped by clearance above that shelf (room for hover). */
function spineSize(workId: string, clearancePx: number) {
  let hash = 0;
  for (let j = 0; j < workId.length; j++) hash = (hash * 31 + workId.charCodeAt(j)) & 0xffff;
  const baseH = 88 + (hash % 3) * 12;
  const baseW = 26 + (hash % 7 === 0 ? 8 : hash % 4 === 0 ? 4 : 0);
  const margin = 6;
  const cap = Math.max(42, Math.min(baseH, Math.floor(clearancePx * 0.82 - margin)));
  const scale = cap / baseH;
  return { widthPx: Math.max(18, Math.round(baseW * scale)), heightPx: cap };
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

/** Mini spine preview for HTML5 drag (cursor follows the ghost). */
function makeSpineDragCanvas(title: string, workId: string, clearancePx: number): { canvas: HTMLCanvasElement; hotX: number; hotY: number } {
  const { widthPx, heightPx } = spineSize(workId, clearancePx);
  const scale = 0.85;
  const dw = Math.max(22, Math.round(widthPx * scale));
  const dh = Math.max(48, Math.round(heightPx * scale));
  const canvas = document.createElement("canvas");
  canvas.width = dw;
  canvas.height = dh;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { canvas, hotX: dw / 2, hotY: dh };
  const col = spineColour(title, 0);
  ctx.fillStyle = col;
  ctx.fillRect(0, 0, dw, dh);
  ctx.fillStyle = "rgba(0,0,0,0.2)";
  ctx.fillRect(0, 0, 3, dh);
  ctx.fillStyle = "rgba(255,255,255,0.2)";
  ctx.fillRect(dw - 2, 0, 2, dh);
  return { canvas, hotX: dw / 2, hotY: dh };
}

let blankDragImageEl: HTMLImageElement | null = null;
function getBlankDragImage(): HTMLImageElement {
  if (!blankDragImageEl) {
    const img = new Image();
    img.src =
      "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
    blankDragImageEl = img;
  }
  return blankDragImageEl;
}

/** Browsers often require the drag image node to be in the document when setDragImage runs. */
function setBookDragGhostImage(e: React.DragEvent, canvas: HTMLCanvasElement, hotX: number, hotY: number) {
  const dt = e.dataTransfer;
  if (!dt) return;
  try {
    canvas.style.cssText =
      "position:fixed;left:-99999px;top:0;width:auto;height:auto;pointer-events:none;opacity:0.99";
    document.body.appendChild(canvas);
    dt.setDragImage(canvas, hotX, hotY);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        canvas.remove();
      });
    });
  } catch {
    try {
      dt.setDragImage(getBlankDragImage(), 0, 0);
    } catch {
      /* allow default drag preview */
    }
  }
}

export default function ShelfScene({
  shelfId,
  shelfAccent,
  books: booksProp,
  ornaments: ornamentsProp,
  lightingPreset,
  tierCount: tierCountProp = 3,
  compact = false,
  readOnly = false,
  onLightingChange,
  onCrossShelfBookDrop,
}: {
  shelfId: string;
  shelfAccent: string;
  books: SceneBook[];
  ornaments: SceneOrnament[];
  lightingPreset: string | null;
  /** Number of horizontal planks (2–5). */
  tierCount?: number;
  /** Tighter chrome for grid cells. */
  compact?: boolean;
  /** Visitor / preview: no editing, drag, or decor controls. */
  readOnly?: boolean;
  onLightingChange: (preset: string | null) => void;
  onCrossShelfBookDrop: (workId: string, fromShelfId: string, layout?: { xPct: number; yPct: number }) => void;
}) {
  const tierCount = Math.max(2, Math.min(5, Math.round(tierCountProp)));
  const canvasRef = useRef<HTMLDivElement>(null);
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

  const dragRef = useRef<null | {
    type: "orn";
    id: string;
    grabOffsetXPx: number;
    grabOffsetYPx: number;
  }>(null);

  const ornSaveRef = useRef<{ id: string; xPct: number; yPct: number } | null>(null);

  const booksPropRef = useRef(booksProp);
  booksPropRef.current = booksProp;
  const bookIdsKey = useMemo(
    () => [...booksProp].map((b) => b.work.id).sort().join("|"),
    [booksProp]
  );
  useEffect(() => {
    setBooks(booksPropRef.current);
  }, [shelfId, bookIdsKey]);

  useEffect(() => {
    setOrnaments(ornamentsProp);
  }, [ornamentsProp]);

  useEffect(() => {
    booksRef.current = books;
  }, [books]);

  useEffect(() => {
    ornamentsRef.current = ornaments;
  }, [ornaments]);

  const plankBottoms = useMemo(
    () => computePlankBottomOffsetsPx(sceneHeightPx, tierCount),
    [sceneHeightPx, tierCount]
  );
  const plankBottomsRef = useRef(plankBottoms);
  plankBottomsRef.current = plankBottoms;

  const backPanelTopPx = useMemo(() => {
    if (!plankBottoms.length) return 14;
    const c = clearanceAboveShelf(0, sceneHeightPx, plankBottoms);
    return Math.min(24, Math.max(10, Math.round(c * 0.08)));
  }, [plankBottoms, sceneHeightPx]);

  useLayoutEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const h = el.getBoundingClientRect().height;
    if (h >= 80) setSceneHeightPx(Math.round(h));
  }, [readOnly, compact, tierCount]);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const h = entries[0]?.contentRect.height;
      if (h >= 80) setSceneHeightPx(Math.round(h));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

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
    const cx = centerX - r.left;
    let xPct = (cx / r.width) * 100;
    const marginX = (halfW / r.width) * 100;
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
    function onMove(e: MouseEvent) {
      const d = dragRef.current;
      if (!d || d.type !== "orn") return;
      const o = ornamentsRef.current.find((x) => x.id === d.id);
      if (!o) return;
      const size = (o.imageUrl ? 44 : 36) * o.scale;
      const centerX = e.clientX - d.grabOffsetXPx;
      const bottom = e.clientY + d.grabOffsetYPx;
      const el = canvasRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const pxFromBottom = r.bottom - bottom;
      const yPct = snapBottomToPct(pxFromBottom, r.height, plankBottomsRef.current);
      const xPct = clampXPct(centerX, size / 2);
      ornSaveRef.current = { id: d.id, xPct, yPct };
      setOrnaments((prev) => prev.map((x) => (x.id === d.id ? { ...x, xPct, yPct } : x)));
    }
    function onUp() {
      const d = dragRef.current;
      dragRef.current = null;
      if (!d || d.type !== "orn") return;
      const pending = ornSaveRef.current;
      ornSaveRef.current = null;
      if (pending && pending.id === d.id) {
        fetch(`/api/shelves/${shelfId}/ornaments/${d.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ xPct: pending.xPct, yPct: pending.yPct }),
        }).catch(() => null);
      }
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [clampXPct, shelfId]);

  function startDragOrn(e: React.MouseEvent, o: SceneOrnament) {
    if (readOnly) return;
    e.preventDefault();
    e.stopPropagation();
    setHoverState(null);
    const el = e.currentTarget as HTMLElement;
    const rect = el.getBoundingClientRect();
    dragRef.current = {
      type: "orn",
      id: o.id,
      grabOffsetXPx: e.clientX - (rect.left + rect.width / 2),
      grabOffsetYPx: rect.bottom - e.clientY,
    };
  }

  function handleBookDragStart(e: React.DragEvent, b: SceneBook) {
    if (readOnly) {
      e.preventDefault();
      return;
    }
    e.stopPropagation();
    setHoverState(null);
    setDraggingWorkId(b.work.id);
    const payload: BookDragPayload = { type: "book", workId: b.work.id, fromShelfId: shelfId };
    setShelfDragPayload(payload);
    e.dataTransfer.setData("application/json", JSON.stringify(payload));
    e.dataTransfer.effectAllowed = "move";
    const bottomPct = snapLayoutYPctToShelfSurface(b.layoutYPct, sceneHeightPx, plankBottoms);
    const si = shelfIndexFromLayoutYPct(bottomPct, sceneHeightPx, plankBottoms);
    const clear = clearanceAboveShelf(si, sceneHeightPx, plankBottoms);
    const { canvas, hotX, hotY } = makeSpineDragCanvas(b.work.title, b.work.id, clear);
    setBookDragGhostImage(e, canvas, hotX, hotY);
  }

  function handleBookDragEnd() {
    setDraggingWorkId(null);
    setDragOverShelfIdx(null);
    setShelfDragPayload(null);
  }

  function parseDropJson(e: React.DragEvent): BookDragPayload | null {
    try {
      const p = JSON.parse(e.dataTransfer.getData("application/json")) as BookDragPayload;
      if (p?.type === "book" && p.workId && p.fromShelfId) return p;
      return null;
    } catch {
      return null;
    }
  }

  function handleCanvasDragOver(e: React.DragEvent) {
    if (readOnly) return;
    const types = e.dataTransfer.types;
    if (!types.includes("application/json") && !types.includes("text/plain")) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const el = canvasRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const pxFromBottom = r.bottom - e.clientY;
    setDragOverShelfIdx(nearestPlankIndex(pxFromBottom, plankBottoms));
  }

  function handleCanvasDragLeave(e: React.DragEvent) {
    if (readOnly) return;
    if (canvasRef.current && !canvasRef.current.contains(e.relatedTarget as Node)) {
      setDragOverShelfIdx(null);
    }
  }

  function handleCanvasDrop(e: React.DragEvent) {
    if (readOnly) return;
    e.preventDefault();
    setDragOverShelfIdx(null);
    const p = parseDropJson(e);
    if (!p) return;
    const el = canvasRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const pxFromBottom = r.bottom - e.clientY;
    const yPct = snapBottomToPct(pxFromBottom, r.height, plankBottoms);
    const si = nearestPlankIndex(pxFromBottom, plankBottoms);
    const clear = clearanceAboveShelf(si, Math.round(r.height), plankBottoms);
    const { widthPx } = spineSize(p.workId, clear);
    const xPct = clampXPct(e.clientX, widthPx / 2);

    if (p.fromShelfId === shelfId) {
      setBooks((prev) => {
        const next = prev.map((book) =>
          book.work.id === p.workId ? { ...book, layoutXPct: xPct, layoutYPct: yPct, layoutZ: 5 } : book
        );
        scheduleSaveBooks(next);
        return next;
      });
    } else {
      onCrossShelfBookDrop(p.workId, p.fromShelfId, { xPct, yPct });
    }
  }

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

  async function removeOrnament(id: string) {
    if (readOnly) return;
    await fetch(`/api/shelves/${shelfId}/ornaments/${id}`, { method: "DELETE" });
    setOrnaments((prev) => prev.filter((o) => o.id !== id));
  }

  const lit = lightingStyle(lightingPreset, shelfAccent);

  return (
    <div
      style={{
        padding: compact ? "6px 0 10px" : "12px 0 20px",
        display: "flex",
        flexDirection: "column",
        flex: compact ? 1 : undefined,
        minHeight: compact ? 0 : undefined,
        width: "100%",
      }}
    >
      {!readOnly && (
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
                  fontSize: 11,
                  padding: "4px 10px",
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

      {!readOnly && (
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
              fontSize: 11,
              fontWeight: 600,
              padding: "4px 10px",
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
                fontSize: 20,
                lineHeight: 1,
                padding: "4px 6px",
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
            Emoji or image · drag to place · shift+click to remove
          </span>
        </div>
      )}

      <div
        ref={canvasRef}
        className="shelf-scene-canvas"
        onDragOver={handleCanvasDragOver}
        onDragLeave={handleCanvasDragLeave}
        onDrop={handleCanvasDrop}
        style={{
          position: "relative",
          flex: 1,
          minHeight: compact
            ? readOnly
              ? "clamp(300px, 58svh, 580px)"
              : "clamp(280px, 52svh, 540px)"
            : 320,
          width: "100%",
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
              {readOnly ? "No books on this shelf yet." : "Drag books here from another shelf, or add from search"}
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
          const { widthPx, heightPx } = spineSize(b.work.id, clear);
          const isDragging = draggingWorkId === b.work.id;
          return (
            <div
              key={b.work.id}
              data-workid={b.work.id}
              className="shelf-book-spine"
              draggable={!readOnly}
              onDragStart={(e) => handleBookDragStart(e, b)}
              onDragEnd={handleBookDragEnd}
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
                borderRadius: "2px 4px 4px 2px",
                overflow: "hidden",
                boxShadow: isDragging ? "none" : "1px 3px 8px rgba(0,0,0,0.32)",
                cursor: readOnly ? "default" : "grab",
                background: colour,
                opacity: isDragging ? 0.35 : 1,
                transition: isDragging
                  ? "opacity 0.12s ease"
                  : "opacity 0.12s ease, bottom 0.2s cubic-bezier(0.4, 0, 0.2, 1), left 0.2s cubic-bezier(0.4, 0, 0.2, 1), transform 0.12s ease, box-shadow 0.12s ease",
              }}
            >
              {b.work.coverUrl && (
                <img
                  src={b.work.coverUrl}
                  alt=""
                  draggable={false}
                  style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none" }}
                />
              )}
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
            </div>
          );
        })}

        {ornaments.map((o) => {
          const ornSi = shelfIndexFromLayoutYPct(o.yPct, sceneHeightPx, plankBottoms);
          const ornClear = clearanceAboveShelf(ornSi, sceneHeightPx, plankBottoms);
          return (
          <div
            key={o.id}
            onMouseDown={readOnly ? undefined : (e) => startDragOrn(e, o)}
            onClick={
              readOnly
                ? undefined
                : (e) => {
                    if (e.shiftKey) {
                      e.preventDefault();
                      removeOrnament(o.id);
                    }
                  }
            }
            style={{
              position: "absolute",
              left: `${o.xPct}%`,
              bottom: `${o.yPct}%`,
              transform: `translateX(-50%) scale(${o.scale})`,
              zIndex: o.zIndex,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "fit-content",
              height: "fit-content",
              fontSize: o.imageUrl
                ? undefined
                : Math.min(32, Math.max(20, Math.round(ornClear * 0.28))),
              lineHeight: 1,
              cursor: readOnly ? "default" : "grab",
              userSelect: "none",
              background: "transparent",
            }}
            title={readOnly ? undefined : "Drag — shift+click to remove"}
          >
            {o.imageUrl ? (
              <img
                src={o.imageUrl}
                alt=""
                draggable={false}
                style={{
                  maxWidth: 44,
                  maxHeight: 44,
                  width: "auto",
                  height: "auto",
                  objectFit: "contain",
                  pointerEvents: "none",
                  display: "block",
                }}
              />
            ) : (
              o.glyph
            )}
          </div>
          );
        })}
      </div>

      {!readOnly && (
        <p style={{ fontSize: 11, color: "var(--muted)", margin: "10px 4px 0", lineHeight: 1.45 }}>
          Drag a spine — a small preview follows the cursor; on release the book snaps to the nearest shelf. Decor uses the same shelf lines.{" "}
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
    </div>
  );
}
