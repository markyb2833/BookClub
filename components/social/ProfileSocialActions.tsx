"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useTheme } from "@/components/ThemeProvider";
import { useMessagesDock } from "@/components/social/MessagesDock";

export default function ProfileSocialActions({
  username,
  initialFollowing,
  initialTheyFollowYou,
  initialYouBlockedThem,
}: {
  username: string;
  initialFollowing: boolean;
  /** True when this profile’s user follows the viewer (pair with `initialFollowing` for mutual). */
  initialTheyFollowYou: boolean;
  initialYouBlockedThem: boolean;
}) {
  const { settings } = useTheme();
  const router = useRouter();
  const messagesDock = useMessagesDock();
  const accent = settings.accentColour;
  const [following, setFollowing] = useState(initialFollowing);
  const [theyFollowYou, setTheyFollowYou] = useState(initialTheyFollowYou);
  const [youBlocked, setYouBlocked] = useState(initialYouBlockedThem);
  const [busy, setBusy] = useState(false);
  const mutualFollow = following && theyFollowYou && !youBlocked;

  useEffect(() => {
    setFollowing(initialFollowing);
    setTheyFollowYou(initialTheyFollowYou);
    setYouBlocked(initialYouBlockedThem);
  }, [initialFollowing, initialTheyFollowYou, initialYouBlockedThem]);

  async function toggleFollow() {
    setBusy(true);
    try {
      const method = following ? "DELETE" : "POST";
      const res = await fetch(`/api/users/${encodeURIComponent(username)}/follow`, { method });
      if (res.ok) {
        setFollowing(!following);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  async function toggleBlock() {
    if (!youBlocked && !window.confirm(`Block @${username}? They won’t be able to see your profile or message you.`)) {
      return;
    }
    setBusy(true);
    try {
      const method = youBlocked ? "DELETE" : "POST";
      const res = await fetch(`/api/users/${encodeURIComponent(username)}/block`, { method });
      if (res.ok) {
        setYouBlocked(!youBlocked);
        if (!youBlocked) setFollowing(false);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginTop: 12 }}>
      <button
        type="button"
        disabled={busy || youBlocked}
        onClick={() => void toggleFollow()}
        style={{
          padding: "8px 16px",
          borderRadius: 10,
          border: "none",
          fontSize: 13,
          fontWeight: 600,
          cursor: busy || youBlocked ? "not-allowed" : "pointer",
          opacity: youBlocked ? 0.5 : 1,
          background: following ? "var(--border)" : accent,
          color: following ? "var(--text)" : "#fff",
        }}
      >
        {following ? "Following" : "Follow"}
      </button>
      {mutualFollow ? (
        <button
          type="button"
          onClick={() => messagesDock.openDirect(username)}
          style={{
            padding: "8px 16px",
            borderRadius: 10,
            border: `1px solid ${accent}55`,
            fontSize: 13,
            fontWeight: 600,
            textDecoration: "none",
            color: accent,
            background: "transparent",
            cursor: "pointer",
          }}
        >
          Message
        </button>
      ) : (
        <span
          title={
            youBlocked
              ? "Unblock to use other actions"
              : "You both need to follow each other to message"
          }
          style={{
            padding: "8px 16px",
            borderRadius: 10,
            border: "1px solid var(--border)",
            fontSize: 13,
            fontWeight: 600,
            color: "var(--muted)",
            cursor: "not-allowed",
            opacity: 0.75,
          }}
        >
          Message
        </span>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={() => void toggleBlock()}
        style={{
          padding: "8px 14px",
          borderRadius: 10,
          border: "1px solid var(--border)",
          fontSize: 13,
          fontWeight: 500,
          background: "transparent",
          color: "var(--muted)",
          cursor: busy ? "not-allowed" : "pointer",
        }}
      >
        {youBlocked ? "Unblock" : "Block"}
      </button>
    </div>
  );
}
