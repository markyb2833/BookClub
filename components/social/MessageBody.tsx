"use client";

import Link from "next/link";
import { useTheme } from "@/components/ThemeProvider";
import ChatRichLink from "@/components/social/ChatRichLink";
import { extractMessageUrls, toAbsoluteUrlForPreview } from "@/lib/social/extractMessageUrls";
import { isProbablyMediaUrl } from "@/lib/social/messageMedia";
import { lineToSegments } from "@/lib/social/messageUrlSpans";
import type { ChatLinkPreview } from "@/lib/social/chatLinkPreviewTypes";
import { useEffect, useMemo, useRef, useState } from "react";

function InlineUrl({
  raw,
  accent,
}: {
  raw: string;
  accent: string;
}) {
  const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost";
  let pathOrExternal = raw;
  try {
    const u = new URL(raw, origin);
    if (u.origin === new URL(origin).origin) {
      pathOrExternal = `${u.pathname}${u.search}${u.hash}`;
      return (
        <Link href={pathOrExternal} style={{ color: accent, wordBreak: "break-all" }}>
          {raw}
        </Link>
      );
    }
  } catch {
    /* fall through */
  }

  if (raw.startsWith("/")) {
    return (
      <Link href={raw} style={{ color: accent, wordBreak: "break-all" }}>
        {raw}
      </Link>
    );
  }

  return (
    <a href={raw} target="_blank" rel="noopener noreferrer" style={{ color: accent, wordBreak: "break-all" }}>
      {raw}
    </a>
  );
}

export default function MessageBody({
  body,
  onInlineMediaLoad,
}: {
  body: string;
  /** Fires when an embedded image/GIF finishes loading (for scroll-to-bottom). */
  onInlineMediaLoad?: () => void;
}) {
  const { settings } = useTheme();
  const accent = settings.accentColour;
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const urlKeys = useMemo(() => {
    const raw = extractMessageUrls(body);
    const seen = new Set<string>();
    const keys: string[] = [];
    for (const r of raw) {
      const abs = toAbsoluteUrlForPreview(r, origin);
      if (!abs || seen.has(abs)) continue;
      seen.add(abs);
      keys.push(abs);
    }
    return keys;
  }, [body, origin]);

  const [previews, setPreviews] = useState<Record<string, ChatLinkPreview | null>>({});
  const fetchGen = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined" || urlKeys.length === 0) return;
    const gen = ++fetchGen.current;
    (async () => {
      try {
        const res = await fetch("/api/link-previews", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ urls: urlKeys }),
        });
        if (!res.ok) return;
        const data = (await res.json()) as { previews: Record<string, ChatLinkPreview | null> };
        if (gen !== fetchGen.current) return;
        setPreviews((prev) => ({ ...prev, ...data.previews }));
      } catch {
        /* ignore */
      }
    })();
  }, [urlKeys]);

  const lines = body.split(/\r?\n/);

  return (
    <div style={{ wordBreak: "break-word" }}>
      {lines.map((line, i) => {
        const t = line.trim();
        if (t && isProbablyMediaUrl(t)) {
          return (
            <div key={i} style={{ marginTop: i > 0 ? 8 : 0 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={t}
                alt=""
                style={{ maxWidth: "100%", maxHeight: 220, borderRadius: 8, display: "block" }}
                loading="eager"
                decoding="async"
                onLoad={onInlineMediaLoad}
              />
            </div>
          );
        }
        if (line === "" && i < lines.length - 1) {
          return <div key={i} style={{ height: 6 }} />;
        }

        const segments = lineToSegments(line);
        return (
          <span key={i} style={{ whiteSpace: "pre-wrap", display: "block" }}>
            {segments.map((seg, j) => {
              if (seg.type === "text") {
                return <span key={j}>{seg.text}</span>;
              }
              const key = toAbsoluteUrlForPreview(seg.raw, origin) ?? seg.raw;
              const preview = previews[key];
              if (preview) {
                const flushTop = j === 0 && segments[0]?.type === "url";
                return (
                  <span key={j} style={{ display: "block" }}>
                    <ChatRichLink preview={preview} accent={accent} flushTop={flushTop} />
                  </span>
                );
              }
              return (
                <span key={j}>
                  <InlineUrl raw={seg.raw} accent={accent} />
                </span>
              );
            })}
          </span>
        );
      })}
    </div>
  );
}
