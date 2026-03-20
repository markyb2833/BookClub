import { useCallback, useEffect, useLayoutEffect, useRef } from "react";

/**
 * Keeps the chat scrolled to the bottom when messages change and when inline
 * images/GIFs load and change content height (ResizeObserver).
 */
export function useMessagesScroll(messageIds: string) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "auto") => {
    const root = scrollRef.current;
    if (!root) return;
    root.scrollTo({ top: root.scrollHeight, behavior });
  }, []);

  useLayoutEffect(() => {
    scrollToBottom("auto");
  }, [messageIds, scrollToBottom]);

  useEffect(() => {
    const inner = contentRef.current;
    const root = scrollRef.current;
    if (!inner || !root) return;

    const ro = new ResizeObserver(() => {
      root.scrollTo({ top: root.scrollHeight, behavior: "auto" });
    });
    ro.observe(inner);
    return () => ro.disconnect();
  }, [messageIds]);

  return { scrollRef, contentRef, scrollToBottom };
}
