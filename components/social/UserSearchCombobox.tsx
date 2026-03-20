"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

type UserHit = { id: string; username: string; displayName: string | null; avatarUrl: string | null };

export default function UserSearchCombobox({
  onPickUsername,
  placeholder = "Search by name or @username…",
}: {
  onPickUsername: (username: string) => void;
  placeholder?: string;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<UserHit[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const search = useCallback(async (raw: string) => {
    const t = raw.trim();
    if (t.length < 2) {
      setUsers([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(t)}`);
      const data = (await res.json()) as { users?: UserHit[] };
      setUsers(data.users ?? []);
    } catch {
      setUsers([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) {
      setUsers([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(() => void search(q), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [q, search]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <input
        type="text"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        autoComplete="off"
        style={{
          width: "100%",
          boxSizing: "border-box",
          borderRadius: 10,
          border: "1px solid var(--border)",
          padding: "10px 14px",
          fontSize: 14,
          background: "var(--bg)",
          color: "var(--text)",
        }}
      />
      {open && (q.trim().length >= 2 || loading) && (
        <div
          style={{
            position: "absolute",
            zIndex: 50,
            left: 0,
            right: 0,
            top: "100%",
            marginTop: 6,
            maxHeight: 240,
            overflowY: "auto",
            borderRadius: 10,
            border: "1px solid var(--border)",
            background: "var(--surface)",
            boxShadow: "0 8px 28px rgba(0,0,0,0.12)",
          }}
        >
          {loading && users.length === 0 ? (
            <div style={{ padding: 14, fontSize: 13, color: "var(--muted)" }}>Searching…</div>
          ) : users.length === 0 ? (
            <div style={{ padding: 14, fontSize: 13, color: "var(--muted)" }}>No matching people</div>
          ) : (
            users.map((u) => {
              const initials = (u.displayName ?? u.username).slice(0, 2).toUpperCase();
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => {
                    onPickUsername(u.username);
                    setQ("");
                    setUsers([]);
                    setOpen(false);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    width: "100%",
                    textAlign: "left",
                    padding: "10px 12px",
                    border: "none",
                    borderBottom: "1px solid var(--border)",
                    background: "transparent",
                    cursor: "pointer",
                    color: "var(--text)",
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: "50%",
                      background: "var(--accent)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 12,
                      fontWeight: 700,
                      color: "#fff",
                      flexShrink: 0,
                      overflow: "hidden",
                    }}
                  >
                    {u.avatarUrl ? (
                      <Image src={u.avatarUrl} alt="" width={36} height={36} style={{ objectFit: "cover" }} />
                    ) : (
                      initials
                    )}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{u.displayName ?? u.username}</div>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>@{u.username}</div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
