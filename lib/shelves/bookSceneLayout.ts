import {
  clearanceAboveShelf,
  shelfIndexFromLayoutYPct,
  snapLayoutYPctToShelfSurface,
} from "./plankLayout";

export type BookSceneDisplayMode = "spine" | "cover";

export function normalizeSceneBookDisplay(v: string | null | undefined): BookSceneDisplayMode {
  return v === "cover" ? "cover" : "spine";
}

/** Per-spine size from clearance (same algorithm as legacy ShelfScene). */
export function spineSize(workId: string, clearancePx: number) {
  let hash = 0;
  for (let j = 0; j < workId.length; j++) hash = (hash * 31 + workId.charCodeAt(j)) & 0xffff;
  const baseH = 88 + (hash % 3) * 12;
  const baseW = 26 + (hash % 7 === 0 ? 8 : hash % 4 === 0 ? 4 : 0);
  const margin = 6;
  const raw = Math.floor(clearancePx * 0.82 - margin);
  const cap = Math.min(baseH, Math.max(8, raw));
  const scale = cap / baseH;
  return { widthPx: Math.max(14, Math.round(baseW * scale)), heightPx: cap };
}

export function bookSceneDimensions(
  workId: string,
  clearancePx: number,
  display: BookSceneDisplayMode,
  widthMul: number,
  heightMul: number
): { widthPx: number; heightPx: number } {
  const wM = Math.min(2, Math.max(0.35, widthMul));
  const hM = Math.min(2, Math.max(0.35, heightMul));
  const spine = spineSize(workId, clearancePx);
  if (display === "cover") {
    const heightPx = Math.max(20, Math.round(spine.heightPx * hM));
    const widthPx = Math.max(16, Math.round(heightPx * (2 / 3) * wM));
    return { widthPx, heightPx };
  }
  return {
    widthPx: Math.max(12, Math.round(spine.widthPx * wM)),
    heightPx: Math.max(8, Math.round(spine.heightPx * hM)),
  };
}

/**
 * Keep book center-x on the same shelf row without overlapping other books (ornaments ignored).
 * `widthPxForBook(workId, layoutYPct)` returns collision width for each book (per-book display/muls).
 */
export function resolveBookCenterXPctNoOverlap(
  desiredCenterXPct: number,
  movingWorkId: string,
  movingLayoutYPct: number,
  movingWidthPx: number,
  canvasWidthPx: number,
  books: ReadonlyArray<{ work: { id: string }; layoutXPct: number; layoutYPct: number }>,
  sceneHeightPx: number,
  plankBottoms: readonly number[],
  widthPxForBook: (workId: string, layoutYPct: number) => number
): number {
  if (canvasWidthPx <= 0) return desiredCenterXPct;
  const wFrac = movingWidthPx / canvasWidthPx;
  const myHalf = (wFrac * 100) / 2;
  const margin = 1;
  /** Allow spines to sit flush (touching); only separate when centers would overlap. */
  const gapPct = 0;

  const yMovingSnapped = snapLayoutYPctToShelfSurface(movingLayoutYPct, sceneHeightPx, plankBottoms);
  const siMove = shelfIndexFromLayoutYPct(yMovingSnapped, sceneHeightPx, plankBottoms);

  const others: { cx: number; half: number }[] = [];
  for (const b of books) {
    if (b.work.id === movingWorkId) continue;
    const yb = snapLayoutYPctToShelfSurface(b.layoutYPct, sceneHeightPx, plankBottoms);
    const si = shelfIndexFromLayoutYPct(yb, sceneHeightPx, plankBottoms);
    if (si !== siMove) continue;
    const widthPx = widthPxForBook(b.work.id, b.layoutYPct);
    const half = ((widthPx / canvasWidthPx) * 100) / 2;
    others.push({ cx: b.layoutXPct, half });
  }

  let cx = Math.max(myHalf + margin, Math.min(100 - myHalf - margin, desiredCenterXPct));

  for (let iter = 0; iter < 20; iter++) {
    let moved = false;
    for (const o of others) {
      const minD = myHalf + o.half + gapPct;
      const d = cx - o.cx;
      if (Math.abs(d) < minD) {
        const sign = d === 0 ? 1 : Math.sign(d);
        cx = o.cx + sign * minD;
        moved = true;
      }
    }
    cx = Math.max(myHalf + margin, Math.min(100 - myHalf - margin, cx));
    if (!moved) break;
  }
  return cx;
}
