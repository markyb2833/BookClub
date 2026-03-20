export const WALL_COL_MIN = 1;
export const WALL_COL_MAX = 4;
export const WALL_ROW_MIN = 1;
export const WALL_ROW_MAX = 3;

export type WallSlots = (string | null)[];

export function clampWallCols(c: number): number {
  return Math.max(WALL_COL_MIN, Math.min(WALL_COL_MAX, Math.round(c)));
}

export function clampWallRows(r: number): number {
  return Math.max(WALL_ROW_MIN, Math.min(WALL_ROW_MAX, Math.round(r)));
}

/** Parse JSON / DB value into slot array; invalid entries become null. */
export function parseWallSlots(raw: unknown, expectedLen: number): WallSlots {
  const out: WallSlots = Array(expectedLen).fill(null);
  if (!Array.isArray(raw)) return out;
  for (let i = 0; i < Math.min(expectedLen, raw.length); i++) {
    const v = raw[i];
    out[i] = typeof v === "string" && v.length > 0 ? v : null;
  }
  return out;
}

/** Fill empty slots from shelf ids (e.g. sort order) without overwriting non-null. */
export function fillEmptySlots(slots: WallSlots, shelfIdsOrdered: string[]): WallSlots {
  const used = new Set(slots.filter(Boolean) as string[]);
  const next = [...slots];
  let si = 0;
  for (let i = 0; i < next.length && si < shelfIdsOrdered.length; i++) {
    if (next[i]) continue;
    while (si < shelfIdsOrdered.length && used.has(shelfIdsOrdered[si])) si++;
    if (si >= shelfIdsOrdered.length) break;
    next[i] = shelfIdsOrdered[si];
    used.add(shelfIdsOrdered[si]);
    si++;
  }
  return next;
}

/** When grid size changes, copy overlapping region row-major. */
export function resizeWallSlots(
  oldSlots: WallSlots,
  oldCols: number,
  oldRows: number,
  newCols: number,
  newRows: number
): WallSlots {
  const next: WallSlots = Array(newCols * newRows).fill(null);
  const copyR = Math.min(oldRows, newRows);
  const copyC = Math.min(oldCols, newCols);
  for (let r = 0; r < copyR; r++) {
    for (let c = 0; c < copyC; c++) {
      const oldIdx = r * oldCols + c;
      const newIdx = r * newCols + c;
      next[newIdx] = oldSlots[oldIdx] ?? null;
    }
  }
  return next;
}

/** Assign shelf to slot; clears any other slot that held the same shelf. */
export function assignWallSlot(slots: WallSlots, index: number, shelfId: string | null): WallSlots {
  const next = [...slots];
  if (shelfId) {
    for (let j = 0; j < next.length; j++) {
      if (j !== index && next[j] === shelfId) next[j] = null;
    }
  }
  next[index] = shelfId;
  return next;
}
