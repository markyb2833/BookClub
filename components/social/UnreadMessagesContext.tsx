"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";

type Ctx = {
  unreadTotal: number;
  refreshUnread: () => Promise<void>;
};

const UnreadCtx = createContext<Ctx>({
  unreadTotal: 0,
  refreshUnread: async () => {},
});

export function UnreadMessagesProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const [unreadTotal, setUnreadTotal] = useState(0);

  const refreshUnread = useCallback(async () => {
    if (!session?.user?.id) return;
    const res = await fetch("/api/messages/unread-count");
    if (res.ok) {
      const d = (await res.json()) as { count: number };
      setUnreadTotal(typeof d.count === "number" ? d.count : 0);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.id) {
      setUnreadTotal(0);
      return;
    }
    void refreshUnread();
    const t = setInterval(() => void refreshUnread(), 12000);
    return () => clearInterval(t);
  }, [status, session?.user?.id, refreshUnread]);

  const value = useMemo(() => ({ unreadTotal, refreshUnread }), [unreadTotal, refreshUnread]);
  return <UnreadCtx.Provider value={value}>{children}</UnreadCtx.Provider>;
}

export function useUnreadMessages() {
  return useContext(UnreadCtx);
}

export function UnreadCountBadge({ count, size = "md" }: { count: number; size?: "sm" | "md" }) {
  if (count < 1) return null;
  const label = count > 99 ? "99+" : String(count);
  const dim = size === "sm" ? { minW: 16, h: 16, fs: 10, pad: "0 5px" } : { minW: 18, h: 18, fs: 11, pad: "0 6px" };
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: dim.minW,
        height: dim.h,
        padding: dim.pad,
        borderRadius: 999,
        background: "#dc2626",
        color: "#fff",
        fontSize: dim.fs,
        fontWeight: 800,
        lineHeight: 1,
        flexShrink: 0,
      }}
    >
      {label}
    </span>
  );
}
