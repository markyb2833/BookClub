"use client";

import Link from "next/link";
import { useTheme } from "@/components/ThemeProvider";
import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { UnreadCountBadge, useUnreadMessages } from "./UnreadMessagesContext";

type DirectItem = {
  type: "direct";
  user: { id: string; username: string; displayName: string | null };
  lastMessage: { body: string; createdAt: string; fromMe: boolean };
  unreadCount: number;
};

type GroupItem = {
  type: "group";
  id: string;
  name: string;
  createdAt: string;
  lastMessage: {
    body: string;
    createdAt: string;
    fromMe: boolean;
    senderUsername: string;
  } | null;
  unreadCount: number;
};

type Props = {
  variant?: "page" | "dock";
  onSelectDirect?: (username: string) => void;
  onSelectGroup?: (groupId: string) => void;
  onNewGroup?: () => void;
};

function RowPreview({ fromMe, body, compact }: { fromMe: boolean; body: string; compact?: boolean }) {
  return (
    <div
      style={{
        fontSize: compact ? 12 : 13,
        color: "var(--muted)",
        marginTop: compact ? 4 : 6,
        minWidth: 0,
        maxWidth: "100%",
        width: "100%",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}
    >
      {fromMe ? "You: " : ""}
      {body}
    </div>
  );
}

export default function MessagesInbox({
  variant = "page",
  onSelectDirect,
  onSelectGroup,
  onNewGroup,
}: Props = {}) {
  const { settings } = useTheme();
  const accent = settings.accentColour;
  const { refreshUnread } = useUnreadMessages();
  const [direct, setDirect] = useState<DirectItem[] | null>(null);
  const [groups, setGroups] = useState<GroupItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dockNav = variant === "dock" && onSelectDirect && onSelectGroup && onNewGroup;

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/messages");
      if (!res.ok) {
        setError("Could not load messages");
        return;
      }
      const data = (await res.json()) as { direct: DirectItem[]; groups: GroupItem[] };
      setDirect(data.direct ?? []);
      setGroups(data.groups ?? []);
      setError(null);
      void refreshUnread();
    } catch {
      setError("Could not load messages");
    }
  }, [refreshUnread]);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 8000);
    return () => clearInterval(t);
  }, [load]);

  const pad = variant === "dock" ? "8px 12px 12px" : "32px 20px 80px";
  const dock = variant === "dock";

  const rowStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    alignItems: "stretch",
    width: "100%",
    maxWidth: "100%",
    minWidth: 0,
    boxSizing: "border-box",
    overflow: "hidden",
    textAlign: "left" as const,
    borderRadius: dock ? 10 : 12,
    border: "1px solid var(--border)",
    background: "var(--surface)",
    padding: dock ? "10px 12px" : "14px 16px",
    textDecoration: "none",
    color: "inherit",
    cursor: "pointer",
    font: "inherit",
  };

  const titleRowStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    minWidth: 0,
    width: "100%",
    flexWrap: "nowrap",
  };

  const titleMainStyle = (fontSize: number): CSSProperties => ({
    fontWeight: 700,
    fontSize,
    color: "var(--text)",
    minWidth: 0,
    flex: 1,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  });

  const loading = direct === null || groups === null;
  const empty = !loading && direct.length === 0 && groups.length === 0;

  return (
    <div
      style={{
        maxWidth: variant === "dock" ? "none" : 560,
        margin: "0 auto",
        padding: pad,
        overflowY: "auto",
        overflowX: "hidden",
        flex: 1,
        minWidth: 0,
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      {dockNav ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", marginBottom: 10 }}>
          <button
            type="button"
            onClick={() => onNewGroup()}
            style={{
              padding: "6px 12px",
              borderRadius: 8,
              border: `1px solid ${accent}55`,
              fontSize: 12,
              fontWeight: 600,
              color: accent,
              whiteSpace: "nowrap",
              background: "transparent",
              cursor: "pointer",
            }}
          >
            New group
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 8 }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--text)", margin: 0 }}>Messages</h1>
          <Link
            href="/messages/new"
            style={{
              padding: "8px 14px",
              borderRadius: 10,
              border: `1px solid ${accent}55`,
              fontSize: 13,
              fontWeight: 600,
              textDecoration: "none",
              color: accent,
              whiteSpace: "nowrap",
            }}
          >
            New group
          </Link>
        </div>
      )}
      {variant === "page" && (
        <p style={{ fontSize: 14, color: "var(--muted)", marginBottom: 24 }}>
          Direct chats only appear when you follow each other. Groups can include mutual friends. New activity sorts to the top within each section.
        </p>
      )}

      {error && (
        <p style={{ color: "#b91c1c", fontSize: 14, marginBottom: 16 }}>{error}</p>
      )}

      {loading ? (
        <p style={{ color: "var(--muted)", fontSize: 14 }}>Loading…</p>
      ) : empty ? (
        <div
          style={{
            borderRadius: 14,
            border: "1.5px dashed var(--border)",
            padding: variant === "dock" ? "24px 16px" : "40px 24px",
            textAlign: "center",
            color: "var(--muted)",
            fontSize: 14,
          }}
        >
          No messages yet. Open a mutual friend’s profile and tap <strong style={{ color: accent }}>Message</strong>, or start a{" "}
          {dockNav ? (
            <button
              type="button"
              onClick={() => onNewGroup()}
              style={{ color: accent, fontWeight: 600, background: "none", border: "none", cursor: "pointer", padding: 0, font: "inherit" }}
            >
              group
            </button>
          ) : (
            <Link href="/messages/new" style={{ color: accent, fontWeight: 600 }}>
              group
            </Link>
          )}
          .
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: dock ? 14 : 22, minWidth: 0, width: "100%" }}>
          {direct.length > 0 && (
            <section style={{ minWidth: 0, width: "100%" }}>
              <h2
                style={{
                  fontSize: dock ? 10 : 11,
                  fontWeight: 700,
                  color: "var(--muted)",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  margin: dock ? "0 0 6px" : "0 0 10px",
                }}
              >
                Direct
              </h2>
              <ul
                style={{
                  listStyle: "none",
                  margin: 0,
                  padding: 0,
                  display: "flex",
                  flexDirection: "column",
                  gap: dock ? 6 : 8,
                  minWidth: 0,
                  width: "100%",
                }}
              >
                {direct.map((item) => (
                  <li key={item.user.id} style={{ minWidth: 0, width: "100%", maxWidth: "100%" }}>
                    {dockNav ? (
                      <button type="button" onClick={() => onSelectDirect(item.user.username)} style={rowStyle}>
                        <div style={titleRowStyle}>
                          <div style={titleMainStyle(dock ? 14 : 15)}>
                            {item.user.displayName ?? item.user.username}
                            <span style={{ fontWeight: 500, color: "var(--muted)", marginLeft: 6 }}>@{item.user.username}</span>
                          </div>
                          <span style={{ flexShrink: 0 }}>
                            <UnreadCountBadge count={item.unreadCount} />
                          </span>
                        </div>
                        <RowPreview compact={dock} fromMe={item.lastMessage.fromMe} body={item.lastMessage.body} />
                      </button>
                    ) : (
                      <Link href={`/messages/${encodeURIComponent(item.user.username)}`} style={rowStyle}>
                        <div style={titleRowStyle}>
                          <div style={titleMainStyle(15)}>
                            {item.user.displayName ?? item.user.username}
                            <span style={{ fontWeight: 500, color: "var(--muted)", marginLeft: 8 }}>@{item.user.username}</span>
                          </div>
                          <span style={{ flexShrink: 0 }}>
                            <UnreadCountBadge count={item.unreadCount} />
                          </span>
                        </div>
                        <RowPreview fromMe={item.lastMessage.fromMe} body={item.lastMessage.body} />
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {groups.length > 0 && (
            <section style={{ minWidth: 0, width: "100%" }}>
              <h2
                style={{
                  fontSize: dock ? 10 : 11,
                  fontWeight: 700,
                  color: "var(--muted)",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  margin: dock ? "0 0 6px" : "0 0 10px",
                }}
              >
                Groups
              </h2>
              <ul
                style={{
                  listStyle: "none",
                  margin: 0,
                  padding: 0,
                  display: "flex",
                  flexDirection: "column",
                  gap: dock ? 6 : 8,
                  minWidth: 0,
                  width: "100%",
                }}
              >
                {groups.map((item) => (
                  <li key={item.id} style={{ minWidth: 0, width: "100%", maxWidth: "100%" }}>
                    {dockNav ? (
                      <button type="button" onClick={() => onSelectGroup(item.id)} style={rowStyle}>
                        <div style={titleRowStyle}>
                          <div style={titleMainStyle(dock ? 14 : 15)}>
                            {item.name}
                            <span
                              style={{
                                fontWeight: 600,
                                fontSize: 11,
                                marginLeft: 10,
                                color: accent,
                                textTransform: "uppercase",
                                letterSpacing: "0.06em",
                              }}
                            >
                              Group
                            </span>
                          </div>
                          <span style={{ flexShrink: 0 }}>
                            <UnreadCountBadge count={item.unreadCount} />
                          </span>
                        </div>
                        <div
                          style={{
                            fontSize: dock ? 12 : 13,
                            color: "var(--muted)",
                            marginTop: dock ? 4 : 6,
                            minWidth: 0,
                            maxWidth: "100%",
                            width: "100%",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {item.lastMessage ? (
                            <>
                              {item.lastMessage.fromMe ? "You: " : `@${item.lastMessage.senderUsername}: `}
                              {item.lastMessage.body}
                            </>
                          ) : (
                            "No messages yet"
                          )}
                        </div>
                      </button>
                    ) : (
                      <Link href={`/messages/g/${encodeURIComponent(item.id)}`} style={rowStyle}>
                        <div style={titleRowStyle}>
                          <div style={titleMainStyle(15)}>
                            {item.name}
                            <span
                              style={{
                                fontWeight: 600,
                                fontSize: 11,
                                marginLeft: 10,
                                color: accent,
                                textTransform: "uppercase",
                                letterSpacing: "0.06em",
                              }}
                            >
                              Group
                            </span>
                          </div>
                          <span style={{ flexShrink: 0 }}>
                            <UnreadCountBadge count={item.unreadCount} />
                          </span>
                        </div>
                        <div
                          style={{
                            fontSize: 13,
                            color: "var(--muted)",
                            marginTop: 6,
                            minWidth: 0,
                            maxWidth: "100%",
                            width: "100%",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {item.lastMessage ? (
                            <>
                              {item.lastMessage.fromMe ? "You: " : `@${item.lastMessage.senderUsername}: `}
                              {item.lastMessage.body}
                            </>
                          ) : (
                            "No messages yet"
                          )}
                        </div>
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
