"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useTheme } from "@/components/ThemeProvider";
import { UnreadCountBadge, useUnreadMessages } from "@/components/social/UnreadMessagesContext";
import MessagesInbox from "./MessagesInbox";
import MessagesThread from "./MessagesThread";
import MessagesGroupThread from "./MessagesGroupThread";
import NewGroupChatForm from "./NewGroupChatForm";

export type DockView =
  | { screen: "inbox" }
  | { screen: "direct"; username: string }
  | { screen: "group"; groupId: string }
  | { screen: "newGroup" };

export type MessagesDockApi = {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  view: DockView;
  goInbox: () => void;
  openDirect: (username: string) => void;
  openGroup: (groupId: string) => void;
  openNewGroup: () => void;
};

const Ctx = createContext<MessagesDockApi | null>(null);

const noop: MessagesDockApi = {
  isOpen: false,
  open: () => {},
  close: () => {},
  toggle: () => {},
  view: { screen: "inbox" },
  goInbox: () => {},
  openDirect: () => {},
  openGroup: () => {},
  openNewGroup: () => {},
};

export function useMessagesDock() {
  return useContext(Ctx) ?? noop;
}

export function MessagesDockProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const uid = session?.user?.id ?? null;
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<DockView>({ screen: "inbox" });

  const api = useMemo<MessagesDockApi>(
    () => ({
      isOpen,
      open: () => setIsOpen(true),
      close: () => setIsOpen(false),
      toggle: () => setIsOpen((o) => !o),
      view,
      goInbox: () => setView({ screen: "inbox" }),
      openDirect: (username: string) => {
        setView({ screen: "direct", username });
        setIsOpen(true);
      },
      openGroup: (groupId: string) => {
        setView({ screen: "group", groupId });
        setIsOpen(true);
      },
      openNewGroup: () => {
        setView({ screen: "newGroup" });
        setIsOpen(true);
      },
    }),
    [isOpen, view]
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setIsOpen(false);
    }
    if (isOpen) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen]);

  return (
    <Ctx.Provider value={api}>
      {children}
      {status === "authenticated" && uid && (
        <MessagesDockChrome userId={uid} isOpen={isOpen} setIsOpen={setIsOpen} view={view} setView={setView} />
      )}
    </Ctx.Provider>
  );
}

function MessagesDockChrome({
  userId,
  isOpen,
  setIsOpen,
  view,
  setView,
}: {
  userId: string;
  isOpen: boolean;
  setIsOpen: (v: boolean) => void;
  view: DockView;
  setView: (v: DockView) => void;
}) {
  const pathname = usePathname();
  const { settings } = useTheme();
  const accent = settings.accentColour;
  const hideFab = pathname.startsWith("/messages");
  const { unreadTotal } = useUnreadMessages();

  return (
    <>
      {!hideFab && (
        <div
          className="messages-dock-fab-wrap"
          style={{
            position: "fixed",
            zIndex: 4040,
            right: 20,
            bottom: "calc(72px + env(safe-area-inset-bottom, 0px))",
            width: 56,
            height: 56,
            pointerEvents: "none",
            transform: "translateZ(0)",
          }}
        >
          <style>{`
            @media (min-width: 768px) {
              .messages-dock-fab-wrap {
                bottom: 24px !important;
                right: 24px !important;
              }
            }
          `}</style>
          <button
            type="button"
            aria-label={
              isOpen
                ? "Close messages"
                : unreadTotal > 0
                  ? `Open messages, ${unreadTotal} unread`
                  : "Open messages"
            }
            onClick={() => setIsOpen(!isOpen)}
            style={{
              width: "100%",
              height: "100%",
              borderRadius: "50%",
              border: "none",
              background: accent,
              color: "#fff",
              cursor: "pointer",
              boxShadow: "0 8px 28px rgba(0,0,0,0.22)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "auto",
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </button>
          {unreadTotal > 0 && (
            <span style={{ position: "absolute", top: -2, right: -2, pointerEvents: "none" }}>
              <UnreadCountBadge count={unreadTotal} />
            </span>
          )}
        </div>
      )}

      {isOpen && (
        <>
          <button
            type="button"
            aria-label="Dismiss messages"
            onClick={() => setIsOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 4050,
              background: "rgba(0,0,0,0.2)",
              border: "none",
              cursor: "pointer",
            }}
          />
          <div
            role="dialog"
            aria-label="Messages"
            style={{
              position: "fixed",
              zIndex: 4051,
              right: 16,
              bottom: "calc(72px + env(safe-area-inset-bottom, 0px) + 64px)",
              width: "min(100vw - 32px, 400px)",
              height: "min(100dvh - 160px, 520px)",
              maxHeight: "calc(100dvh - 120px)",
              borderRadius: 16,
              border: "1px solid var(--border)",
              background: "var(--bg)",
              boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              minWidth: 0,
            }}
            className="messages-dock-panel"
          >
            <style>{`
              @media (min-width: 768px) {
                .messages-dock-panel {
                  bottom: 96px !important;
                  right: 24px !important;
                  height: min(100dvh - 48px, 560px) !important;
                }
              }
            `}</style>
            <div
              style={{
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                padding: "10px 12px",
                borderBottom: "1px solid var(--border)",
                background: "var(--surface)",
              }}
            >
              <span style={{ fontWeight: 800, fontSize: 15, color: "var(--text)", letterSpacing: "-0.02em" }}>Messages</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Link
                  href="/messages"
                  style={{ fontSize: 12, color: accent, fontWeight: 600, textDecoration: "none" }}
                  onClick={() => setIsOpen(false)}
                >
                  Full page
                </Link>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    background: "var(--bg)",
                    color: "var(--muted)",
                    cursor: "pointer",
                    fontSize: 18,
                    lineHeight: 1,
                  }}
                >
                  ×
                </button>
              </div>
            </div>

            <div
              style={{
                flex: 1,
                minHeight: 0,
                minWidth: 0,
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
              }}
            >
              {view.screen === "inbox" && (
                <MessagesInbox
                  variant="dock"
                  onSelectDirect={(u) => setView({ screen: "direct", username: u })}
                  onSelectGroup={(id) => setView({ screen: "group", groupId: id })}
                  onNewGroup={() => setView({ screen: "newGroup" })}
                />
              )}
              {view.screen === "direct" && (
                <MessagesThread
                  username={view.username}
                  myUserId={userId}
                  embedded
                  onBack={() => setView({ screen: "inbox" })}
                />
              )}
              {view.screen === "group" && (
                <MessagesGroupThread
                  groupId={view.groupId}
                  myUserId={userId}
                  embedded
                  onBack={() => setView({ screen: "inbox" })}
                />
              )}
              {view.screen === "newGroup" && (
                <div style={{ overflowY: "auto", flex: 1, padding: "12px 14px 16px" }}>
                  <button
                    type="button"
                    onClick={() => setView({ screen: "inbox" })}
                    style={{
                      fontSize: 13,
                      color: "var(--muted)",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: 0,
                      marginBottom: 10,
                    }}
                  >
                    ← Inbox
                  </button>
                  <NewGroupChatForm
                    compact
                    onCreated={(id) => setView({ screen: "group", groupId: id })}
                  />
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
