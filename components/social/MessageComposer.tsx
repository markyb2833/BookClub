"use client";

import { useTheme } from "@/components/ThemeProvider";
import { useCallback, useEffect, useRef, useState } from "react";
import { MESSAGE_EMOJI_GRID } from "./messageEmojis";

type GifHit = { id: string; previewUrl: string; url: string };

function insertAtCursor(textarea: HTMLTextAreaElement, insert: string) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const before = textarea.value.slice(0, start);
  const after = textarea.value.slice(end);
  const next = before + insert + after;
  const caret = start + insert.length;
  textarea.value = next;
  textarea.setSelectionRange(caret, caret);
  textarea.focus();
  return next;
}

export default function MessageComposer({
  value,
  onChange,
  onSend,
  placeholder,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  placeholder: string;
  disabled?: boolean;
}) {
  const { settings } = useTheme();
  const accent = settings.accentColour;
  const taRef = useRef<HTMLTextAreaElement>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [gifOpen, setGifOpen] = useState(false);
  const [gifQ, setGifQ] = useState("");
  const [gifHits, setGifHits] = useState<GifHit[]>([]);
  const [gifLoading, setGifLoading] = useState(false);
  const [gifDisabled, setGifDisabled] = useState(false);
  const popRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (popRef.current?.contains(t)) return;
      setEmojiOpen(false);
      setGifOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const runGifSearch = useCallback(async (q: string) => {
    setGifLoading(true);
    try {
      const res = await fetch(`/api/gifs?q=${encodeURIComponent(q || "book")}`);
      const data = (await res.json()) as { results?: GifHit[]; disabled?: boolean };
      if (data.disabled) {
        setGifDisabled(true);
        setGifHits([]);
        return;
      }
      setGifDisabled(false);
      setGifHits(data.results ?? []);
    } catch {
      setGifHits([]);
    } finally {
      setGifLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!gifOpen) return;
    const t = setTimeout(() => void runGifSearch(gifQ), 280);
    return () => clearTimeout(t);
  }, [gifOpen, gifQ, runGifSearch]);

  function pickEmoji(ch: string) {
    const ta = taRef.current;
    if (!ta) return;
    const next = insertAtCursor(ta, ch);
    onChange(next);
    setEmojiOpen(false);
  }

  function pickGif(url: string) {
    const ta = taRef.current;
    if (!ta) return;
    const next = insertAtCursor(ta, (ta.value ? "\n" : "") + url);
    onChange(next);
    setGifOpen(false);
  }

  const pickerMaxHeight = gifOpen ? 320 : 220;

  return (
    <div ref={popRef} style={{ display: "flex", flexDirection: "column", gap: 8, flexShrink: 0, position: "relative" }}>
      {(emojiOpen || gifOpen) && (
        <div
          style={{
            position: "absolute",
            bottom: "100%",
            left: gifOpen ? "auto" : 0,
            right: 0,
            marginBottom: 6,
            borderRadius: 12,
            border: "1px solid var(--border)",
            background: "var(--surface)",
            boxShadow: "0 12px 40px rgba(0,0,0,0.18)",
            maxHeight: pickerMaxHeight,
            width: gifOpen ? "min(100vw - 24px, 300px)" : "100%",
            minWidth: gifOpen ? 260 : undefined,
            overflow: "hidden",
            zIndex: 5,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {emojiOpen && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(8, 1fr)",
                gap: 4,
                padding: 10,
                maxHeight: 210,
                overflowY: "auto",
              }}
            >
              {MESSAGE_EMOJI_GRID.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => pickEmoji(e)}
                  style={{
                    fontSize: 22,
                    lineHeight: 1,
                    padding: 6,
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    borderRadius: 8,
                  }}
                >
                  {e}
                </button>
              ))}
            </div>
          )}
          {gifOpen && (
            <div style={{ display: "flex", flexDirection: "column", maxHeight: pickerMaxHeight }}>
              <input
                value={gifQ}
                onChange={(e) => setGifQ(e.target.value)}
                placeholder={gifDisabled ? "GIF search not configured" : "Search GIFs…"}
                disabled={gifDisabled}
                style={{
                  margin: 8,
                  marginBottom: 6,
                  flexShrink: 0,
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  padding: "8px 10px",
                  fontSize: 13,
                  background: "var(--bg)",
                  color: "var(--text)",
                }}
              />
              <div
                style={{
                  maxHeight: 248,
                  minHeight: 96,
                  overflowY: "auto",
                  overflowX: "hidden",
                  padding: "0 8px 8px",
                  WebkitOverflowScrolling: "touch",
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                    gap: 6,
                    alignContent: "start",
                  }}
                >
                  {gifLoading ? (
                    <span style={{ gridColumn: "1 / -1", fontSize: 13, color: "var(--muted)", padding: 8 }}>Loading…</span>
                  ) : gifDisabled ? (
                    <span style={{ gridColumn: "1 / -1", fontSize: 12, color: "var(--muted)", padding: 8, lineHeight: 1.5 }}>
                      Add <code style={{ fontSize: 11 }}>GIPHY_API_KEY</code> from{" "}
                      <a href="https://developers.giphy.com/dashboard/" target="_blank" rel="noopener noreferrer" style={{ color: "inherit" }}>
                        Giphy
                      </a>{" "}
                      to <code style={{ fontSize: 11 }}>.env</code>.
                    </span>
                  ) : gifHits.length === 0 ? (
                    <span style={{ gridColumn: "1 / -1", fontSize: 13, color: "var(--muted)", padding: 8 }}>No results</span>
                  ) : (
                    gifHits.map((g) => (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => pickGif(g.url)}
                        style={{
                          display: "block",
                          minWidth: 0,
                          width: "100%",
                          height: 78,
                          padding: 0,
                          border: "none",
                          borderRadius: 8,
                          overflow: "hidden",
                          cursor: "pointer",
                          background: "var(--border)",
                          flexShrink: 0,
                        }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={g.previewUrl}
                          alt=""
                          style={{
                            display: "block",
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                          }}
                        />
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div style={{ display: "flex", gap: 6, alignItems: "flex-end" }}>
        <div style={{ display: "flex", gap: 4, flexShrink: 0, paddingBottom: 4 }}>
          <button
            type="button"
            disabled={disabled}
            title="Emoji"
            onClick={() => {
              setGifOpen(false);
              setEmojiOpen((o) => !o);
            }}
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: "var(--bg)",
              fontSize: 18,
              cursor: disabled ? "not-allowed" : "pointer",
              lineHeight: 1,
            }}
          >
            😊
          </button>
          <button
            type="button"
            disabled={disabled}
            title="GIF"
            onClick={() => {
              setEmojiOpen(false);
              setGifOpen((o) => !o);
              if (!gifOpen) void runGifSearch(gifQ || "book");
            }}
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: "var(--bg)",
              fontSize: 12,
              fontWeight: 700,
              color: accent,
              cursor: disabled ? "not-allowed" : "pointer",
            }}
          >
            GIF
          </button>
        </div>
        <textarea
          ref={taRef}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
          placeholder={placeholder}
          rows={2}
          style={{
            flex: 1,
            borderRadius: 10,
            border: "1px solid var(--border)",
            padding: "10px 12px",
            fontSize: 14,
            background: "var(--bg)",
            color: "var(--text)",
            resize: "none",
            minHeight: 44,
            maxHeight: 120,
            fontFamily: "inherit",
          }}
        />
        <button
          type="button"
          disabled={disabled}
          onClick={() => onSend()}
          style={{
            padding: "0 16px",
            height: 44,
            alignSelf: "flex-end",
            borderRadius: 10,
            border: "none",
            background: accent,
            color: "#fff",
            fontWeight: 600,
            fontSize: 14,
            cursor: disabled ? "not-allowed" : "pointer",
            opacity: disabled ? 0.5 : 1,
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}
