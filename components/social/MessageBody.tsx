"use client";

import { isProbablyMediaUrl } from "@/lib/social/messageMedia";

export default function MessageBody({
  body,
  onInlineMediaLoad,
}: {
  body: string;
  /** Fires when an embedded image/GIF finishes loading (for scroll-to-bottom). */
  onInlineMediaLoad?: () => void;
}) {
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
        return (
          <span key={i} style={{ whiteSpace: "pre-wrap", display: "block" }}>
            {line}
          </span>
        );
      })}
    </div>
  );
}
