"use client";

import Link from "next/link";
import { useTheme } from "@/components/ThemeProvider";
import { useRouter } from "next/navigation";
import { useState, useCallback } from "react";
import UserSearchCombobox from "@/components/social/UserSearchCombobox";

export default function NewGroupChatForm({
  compact,
  onCreated,
}: {
  compact?: boolean;
  /** When set (e.g. messages dock), skip full-page navigation. */
  onCreated?: (groupId: string) => void;
} = {}) {
  const { settings } = useTheme();
  const accent = settings.accentColour;
  const router = useRouter();
  const [name, setName] = useState("");
  const [membersRaw, setMembersRaw] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const appendMember = useCallback((username: string) => {
    const u = username.replace(/^@/, "").trim();
    if (!u) return;
    setMembersRaw((prev) => {
      const tokens = prev
        .split(/[\s,]+/)
        .map((s) => s.replace(/^@/, "").trim())
        .filter(Boolean);
      if (tokens.some((t) => t.toLowerCase() === u.toLowerCase())) return prev;
      const prefix = prev.trim() ? `${prev.trim()} ` : "";
      return `${prefix}@${u}`;
    });
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Name the group");
      return;
    }
    const memberUsernames = membersRaw
      .split(/[\s,]+/)
      .map((s) => s.replace(/^@/, "").trim())
      .filter(Boolean);
    if (memberUsernames.length === 0) {
      setError("Add at least one person (username)");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/group-chats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmedName, memberUsernames }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; id?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not create group");
        return;
      }
      if (data.id) {
        if (onCreated) onCreated(data.id);
        else router.push(`/messages/g/${encodeURIComponent(data.id)}`);
      } else setError("Could not create group");
    } finally {
      setBusy(false);
    }
  }

  const outerPad = compact ? "0" : "32px 20px 80px";

  return (
    <div style={{ maxWidth: compact ? "none" : 480, margin: "0 auto", padding: outerPad }}>
      {!compact && (
        <Link href="/messages" style={{ fontSize: 13, color: "var(--muted)", textDecoration: "none" }}>
          ← Inbox
        </Link>
      )}
      <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text)", margin: "12px 0 8px" }}>New group</h1>
      <p style={{ fontSize: 14, color: "var(--muted)", marginBottom: 24, lineHeight: 1.5 }}>
        Everyone you add must already follow you and be followed by you, and nobody can be blocked.
      </p>

      {error && <p style={{ color: "#b91c1c", fontSize: 14, marginBottom: 16 }}>{error}</p>}

      <form onSubmit={(e) => void submit(e)} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>Add people</span>
          <UserSearchCombobox onPickUsername={appendMember} placeholder="Search people by name or @username…" />
          <span style={{ fontSize: 12, color: "var(--muted)" }}>Picks append to the list below. You can still type @names manually.</span>
        </div>
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>Group name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            placeholder="Tuesday book club"
            style={{
              borderRadius: 10,
              border: "1px solid var(--border)",
              padding: "10px 14px",
              fontSize: 14,
              background: "var(--bg)",
              color: "var(--text)",
            }}
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>Members (usernames)</span>
          <textarea
            value={membersRaw}
            onChange={(e) => setMembersRaw(e.target.value)}
            rows={4}
            placeholder="@alice @bob or comma / line separated"
            style={{
              borderRadius: 10,
              border: "1px solid var(--border)",
              padding: "10px 14px",
              fontSize: 14,
              background: "var(--bg)",
              color: "var(--text)",
              resize: "vertical",
            }}
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          style={{
            padding: "12px 18px",
            borderRadius: 10,
            border: "none",
            background: accent,
            color: "#fff",
            fontWeight: 600,
            fontSize: 14,
            cursor: busy ? "not-allowed" : "pointer",
            opacity: busy ? 0.7 : 1,
          }}
        >
          {busy ? "Creating…" : "Create group"}
        </button>
      </form>
    </div>
  );
}
