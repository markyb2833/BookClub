"use client";

import Link from "next/link";
import { useTheme } from "@/components/ThemeProvider";
import { useCallback, useEffect, useState } from "react";
import MessageBody from "./MessageBody";
import MessageComposer from "./MessageComposer";
import { useUnreadMessages } from "./UnreadMessagesContext";
import { useMessagesScroll } from "./useMessagesScroll";

type Msg = { id: string; body: string; createdAt: string; senderId: string };
type Partner = { id: string; username: string; displayName: string | null };

export default function MessagesThread({
  username,
  myUserId,
  embedded,
  onBack,
}: {
  username: string;
  myUserId: string;
  embedded?: boolean;
  onBack?: () => void;
}) {
  const { settings } = useTheme();
  const accent = settings.accentColour;
  const { refreshUnread } = useUnreadMessages();
  const [partner, setPartner] = useState<Partner | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const messageIdsKey = messages.map((m) => m.id).join("|");
  const { scrollRef, contentRef, scrollToBottom } = useMessagesScroll(messageIdsKey);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/messages?with=${encodeURIComponent(username)}`);
      if (res.status === 403) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        setError(
          err.error === "Mutual follow required"
            ? "You both need to follow each other to message."
            : "You can’t message this user."
        );
        return;
      }
      if (!res.ok) {
        setError("Could not load thread");
        return;
      }
      const data = (await res.json()) as { partner: Partner; messages: Msg[] };
      setPartner(data.partner);
      setMessages(data.messages);
      setError(null);
      void refreshUnread();
    } catch {
      setError("Could not load thread");
    }
  }, [username, refreshUnread]);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 5000);
    return () => clearInterval(t);
  }, [load]);

  async function send() {
    const body = text.trim();
    if (!body) return;
    setText("");
    const res = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipientUsername: username, body }),
    });
    if (!res.ok) {
      setText(body);
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      setError(
        err.error === "Mutual follow required"
          ? "Mutual follow required to send."
          : "Could not send"
      );
      return;
    }
    setError(null);
    void load();
  }

  const label = partner ? partner.displayName ?? partner.username : `@${username}`;
  const outerPad = embedded ? "10px 12px 12px" : "24px 20px 100px";
  const outerHeight = embedded
    ? { flex: 1, minHeight: 0, display: "flex" as const, flexDirection: "column" as const }
    : {
        maxWidth: 560,
        margin: "0 auto",
        padding: outerPad,
        display: "flex" as const,
        flexDirection: "column" as const,
        height: "calc(100vh - 80px)",
        maxHeight: 720,
      };

  return (
    <div
      style={
        embedded
          ? { ...outerHeight, padding: outerPad, minWidth: 0, width: "100%", maxWidth: "100%", boxSizing: "border-box" }
          : outerHeight
      }
    >
      <div style={{ marginBottom: embedded ? 8 : 16, flexShrink: 0 }}>
        {embedded ? (
          <button
            type="button"
            onClick={onBack}
            style={{ fontSize: 12, color: "var(--muted)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
          >
            ← Inbox
          </button>
        ) : (
          <Link href="/messages" style={{ fontSize: 13, color: "var(--muted)", textDecoration: "none" }}>
            ← Inbox
          </Link>
        )}
        <h1 style={{ fontSize: embedded ? 16 : 20, fontWeight: 800, color: "var(--text)", margin: embedded ? "4px 0 0" : "10px 0 0", lineHeight: 1.25 }}>{label}</h1>
        {partner && (
          <Link
            href={`/u/${encodeURIComponent(partner.username)}/profile`}
            style={{ fontSize: embedded ? 12 : 13, color: accent, textDecoration: "none", display: "inline-block", marginTop: embedded ? 2 : 0 }}
          >
            View profile
          </Link>
        )}
      </div>

      {error && <p style={{ color: "#b91c1c", fontSize: 13, marginBottom: 8 }}>{error}</p>}

      <div
        ref={scrollRef}
        style={{
          flex: 1,
          minHeight: embedded ? 100 : undefined,
          overflowY: "auto",
          border: "1px solid var(--border)",
          borderRadius: embedded ? 10 : 12,
          padding: embedded ? 10 : 12,
          background: "var(--surface)",
          marginBottom: embedded ? 8 : 12,
        }}
      >
        <div ref={contentRef}>
          {messages.map((m) => {
            const mine = m.senderId === myUserId;
            return (
              <div
                key={m.id}
                style={{
                  marginBottom: 10,
                  display: "flex",
                  justifyContent: mine ? "flex-end" : "flex-start",
                }}
              >
                <div
                  style={{
                    maxWidth: "85%",
                    borderRadius: 12,
                    padding: "8px 12px",
                    fontSize: 14,
                    lineHeight: 1.45,
                    background: mine ? `${accent}28` : "var(--bg)",
                    color: "var(--text)",
                    border: mine ? `1px solid ${accent}40` : "1px solid var(--border)",
                  }}
                >
                  <MessageBody body={m.body} onInlineMediaLoad={() => scrollToBottom()} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <MessageComposer
        value={text}
        onChange={setText}
        onSend={() => void send()}
        placeholder="Message…  @ book or author  ·  /user  ·  🔗"
        disabled={!!error && error.includes("follow")}
      />
    </div>
  );
}
