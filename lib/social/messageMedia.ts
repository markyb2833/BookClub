/** Whether a string is a lone URL that should render as an embedded image/GIF in chat. */
export function isProbablyMediaUrl(s: string): boolean {
  const t = s.trim();
  if (!t || /\s/.test(t)) return false;
  if (!/^https?:\/\//i.test(t)) return false;
  if (/\.(gif|png|jpe?g|webp)(\?|#|$)/i.test(t)) return true;
  if (/tenor\.com|giphy\.com|media\.giphy|gfycat\.com/i.test(t)) return true;
  return false;
}
