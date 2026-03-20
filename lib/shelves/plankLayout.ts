/** Physical shelf scene: horizontal planks (tiers) from bottom of a scene of given height. */

export const PLANK_HEIGHT = 12;
export const PLANK_INSET = 14;
const BOTTOM_PAD = 12;
/** Floor for alcove height on very short scenes (avoid degenerate layout). */
const MIN_ALCOVE_PX = 8;

/**
 * Bottom offset (px from scene bottom) of each plank, lowest shelf first.
 * `tierCount` clamped to 2–5.
 *
 * Uses **equal vertical bands**: headroom above the top shelf equals the space between each pair of
 * shelf surfaces (same as one “book alcove”). This keeps the top tier visually aligned with the rest
 * and avoids cramming books against the fairy-light strip.
 */
export function computePlankBottomOffsetsPx(sceneHeight: number, tierCount: number): number[] {
  const n = Math.max(2, Math.min(5, Math.round(tierCount)));
  const H = Math.max(120, sceneHeight);
  if (n === 1) return [BOTTOM_PAD];

  const rawAlcove = (H - BOTTOM_PAD - n * PLANK_HEIGHT) / n;
  const alcove = Math.max(MIN_ALCOVE_PX, rawAlcove);

  const offsets: number[] = [];
  for (let k = 0; k < n; k++) {
    offsets.push(BOTTOM_PAD + k * (PLANK_HEIGHT + alcove));
  }
  return offsets;
}

export function surfacePxFromBottom(plankBottomPx: number): number {
  return plankBottomPx + PLANK_HEIGHT;
}

export function snapBottomPxToShelf(pxFromBottom: number, plankBottoms: readonly number[]): number {
  const targets = plankBottoms.map((b) => surfacePxFromBottom(b));
  let best = targets[0];
  let bestD = Math.abs(pxFromBottom - best);
  for (const t of targets) {
    const d = Math.abs(pxFromBottom - t);
    if (d < bestD) {
      bestD = d;
      best = t;
    }
  }
  return best;
}

export function snapBottomPxToPct(pxFromBottom: number, sceneHeight: number, plankBottoms: readonly number[]): number {
  const px = snapBottomPxToShelf(pxFromBottom, plankBottoms);
  return (px / sceneHeight) * 100;
}

/** Re-align stored bottom % to the nearest shelf surface (fixes drift when tier layout or height changes). */
export function snapLayoutYPctToShelfSurface(
  yPct: number,
  sceneHeight: number,
  plankBottoms: readonly number[]
): number {
  if (sceneHeight <= 0 || plankBottoms.length === 0) return yPct;
  const pxFromBottom = (yPct / 100) * sceneHeight;
  const snappedPx = snapBottomPxToShelf(pxFromBottom, plankBottoms);
  return (snappedPx / sceneHeight) * 100;
}

export function nearestShelfIndex(pxFromBottom: number, plankBottoms: readonly number[]): number {
  const targets = plankBottoms.map((b) => surfacePxFromBottom(b));
  let idx = 0;
  let bestD = Infinity;
  targets.forEach((t, i) => {
    const d = Math.abs(pxFromBottom - t);
    if (d < bestD) {
      bestD = d;
      idx = i;
    }
  });
  return idx;
}

/** Vertical space (px) from shelf surface `shelfIndex` to the next plank above, or to the scene top for the top shelf. */
export function clearanceAboveShelf(
  shelfIndex: number,
  sceneHeight: number,
  plankBottoms: readonly number[]
): number {
  const n = plankBottoms.length;
  if (n === 0 || shelfIndex < 0 || shelfIndex >= n) return 48;
  const surface = surfacePxFromBottom(plankBottoms[shelfIndex]);
  if (shelfIndex < n - 1) {
    return Math.max(12, plankBottoms[shelfIndex + 1] - surface);
  }
  return Math.max(12, sceneHeight - surface);
}

export function shelfIndexFromLayoutYPct(
  yPct: number,
  sceneHeight: number,
  plankBottoms: readonly number[]
): number {
  const pxFromBottom = (yPct / 100) * sceneHeight;
  return nearestShelfIndex(pxFromBottom, plankBottoms);
}
