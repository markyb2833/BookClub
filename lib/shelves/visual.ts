/** Shared shelf visuals for dashboard + public profile views */

export const DEFAULT_SHELF_EMOJIS: Record<string, string> = {
  "want-to-read": "🔖",
  "currently-reading": "📖",
  "read": "✅",
};

const SPINE_PALETTE = [
  "#c084fc", "#f472b6", "#fb923c", "#fbbf24", "#34d399",
  "#38bdf8", "#818cf8", "#e879f9", "#4ade80", "#f87171",
  "#a78bfa", "#2dd4bf", "#facc15", "#60a5fa", "#fb7185",
];

export function spineColour(title: string, i: number): string {
  let hash = 0;
  for (let j = 0; j < title.length; j++) hash = (hash * 31 + title.charCodeAt(j)) & 0xffff;
  return SPINE_PALETTE[(hash + i) % SPINE_PALETTE.length];
}

/** Muted border derived from accent (hex #rrggbb) */
export function accentBorder(accent: string, alpha = 0.35): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(accent)) return "var(--border)";
  const r = parseInt(accent.slice(1, 3), 16);
  const g = parseInt(accent.slice(3, 5), 16);
  const b = parseInt(accent.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
