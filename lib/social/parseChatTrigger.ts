export type ChatTrigger =
  | { kind: "at"; start: number; query: string }
  | { kind: "slash"; start: number; query: string };

/**
 * Detects an active @mention (books/authors; query may include spaces) or /user lookup
 * on the current line before the cursor.
 */
export function parseChatTrigger(value: string, cursor: number): ChatTrigger | null {
  const lineStart = value.lastIndexOf("\n", cursor - 1) + 1;
  const lineBeforeCursor = value.slice(lineStart, cursor);

  let atMatch: ChatTrigger | null = null;
  const lastAt = lineBeforeCursor.lastIndexOf("@");
  if (lastAt >= 0) {
    const prev = lastAt === 0 ? " " : lineBeforeCursor[lastAt - 1];
    if (lastAt === 0 || /\s/.test(prev)) {
      const query = lineBeforeCursor.slice(lastAt + 1);
      if (!query.includes("@")) {
        atMatch = { kind: "at", start: lineStart + lastAt, query };
      }
    }
  }

  let slashMatch: ChatTrigger | null = null;
  const lastSl = lineBeforeCursor.lastIndexOf("/");
  if (lastSl >= 0) {
    const prev = lastSl === 0 ? " " : lineBeforeCursor[lastSl - 1];
    if (lastSl === 0 || /\s/.test(prev)) {
      const query = lineBeforeCursor.slice(lastSl + 1);
      if (/^[a-zA-Z0-9_]*$/.test(query)) {
        slashMatch = { kind: "slash", start: lineStart + lastSl, query };
      }
    }
  }

  if (!atMatch) return slashMatch;
  if (!slashMatch) return atMatch;
  return atMatch.start >= slashMatch.start ? atMatch : slashMatch;
}
