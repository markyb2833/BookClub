"use client";

import Link from "next/link";
import { useTheme } from "@/components/ThemeProvider";
import { useCallback, useEffect, useState } from "react";
import MessageBody from "./MessageBody";
import MessageComposer from "./MessageComposer";
import { useUnreadMessages } from "./UnreadMessagesContext";
import { useMessagesScroll } from "./useMessagesScroll";

type Sender = { id: string; username: string; displayName: string | null; avatarUrl: string | null };
type Msg = { id: string; body: string; createdAt: string; sender: Sender };

export default function MessagesGroupThread({
  groupId,
  myUserId,
  embedded,
  onBack,
}: {
  groupId: string;
  myUserId: string;
  embedded?: boolean;
  onBack?: () => void;
}) {
  const { settings } = useTheme();
  const accent = settings.accentColour;
  const { refreshUnread } = useUnreadMessages();
  const [groupName, setGroupName] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const messageIdsKey = messages.map((m) => m.id).join("|");
  const { scrollRef, contentRef, scrollToBottom } = useMessagesScroll(messageIdsKey);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/group-chats/${encodeURIComponent(groupId)}/messages`);
      if (res.status === 403) {
        setError("You’re not in this group.");
        return;
      }
      if (!res.ok) {
        setError("Could not load group");
        return;
      }
      const data = (await res.json()) as { group?: { name: string }; messages: Msg[] };
      if (data.group?.name) setGroupName(data.group.name);
      setMessages(data.messages);
      setError(null);
      void refreshUnread();
    } catch {
      setError("Could not load group");
    }
  }, [groupId, refreshUnread]);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 5000);
    return () => clearInterval(t);
  }, [load]);

  async function send() {
    const body = text.trim();
    if (!body) return;
    setText("");
    const res = await fetch(`/api/group-chats/${encodeURIComponent(groupId)}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    if (!res.ok) {
      setText(body);
      setError("Could not send");
      return;
    }
    setError(null);
    void load();
  }

  const outerPad = embedded ? "10px 12px 12px" : "24px 20px 100px";
  const outerStyle = embedded
    ? { flex: 1, minHeight: 0, display: "flex" as const, flexDirection: "column" as const, padding: outerPad }
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
          ? { ...outerStyle, minWidth: 0, width: "100%", maxWidth: "100%", boxSizing: "border-box" }
          : outerStyle
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
        <h1 style={{ fontSize: embedded ? 16 : 20, fontWeight: 800, color: "var(--text)", margin: embedded ? "4px 0 0" : "10px 0 0", lineHeight: 1.25 }}>{groupName ?? "Group"}</h1>
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
            const mine = m.sender.id === myUserId;
            return (
              <div
                key={m.id}
                style={{
                  marginBottom: 10,
                  display: "flex",
                  justifyContent: mine ? "flex-end" : "flex-start",
                  flexDirection: "column",
                  alignItems: mine ? "flex-end" : "flex-start",
                }}
              >
                {!mine && (
                  <span style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4, marginLeft: 2 }}>
                    @{m.sender.username}
                  </span>
                )}
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
        disabled={!!error && error.includes("not in this group")}
      />
    </div>
  );
}
