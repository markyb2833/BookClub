import Image from "next/image";
import Link from "next/link";
import type { UserPublicHeaderUser } from "@/lib/social/loadPublicUserWall";
import ProfileSocialActions from "@/components/social/ProfileSocialActions";

function encSeg(s: string) {
  return encodeURIComponent(s);
}

export default function UserPublicShelvesHeader({
  user,
  sessionUserId,
  isOwn,
  initialFollowing,
  initialTheyFollowYou,
  initialYouBlockedThem,
}: {
  user: UserPublicHeaderUser;
  sessionUserId: string | null;
  isOwn: boolean;
  initialFollowing: boolean;
  initialTheyFollowYou: boolean;
  initialYouBlockedThem: boolean;
}) {
  const initials = (user.displayName ?? user.username).slice(0, 2).toUpperCase();
  const u = user.username;

  const stat = (href: string, value: number, label: string) => (
    <Link
      href={href}
      style={{ textAlign: "center", textDecoration: "none", color: "inherit", minWidth: 72 }}
    >
      <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text)" }}>{value}</div>
      <div
        style={{
          fontSize: 11,
          color: "var(--muted)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        {label}
      </div>
    </Link>
  );

  return (
    <div style={{ marginBottom: 28 }}>
      <div
        style={{
          display: "flex",
          gap: 20,
          flexWrap: "wrap",
          alignItems: "flex-start",
          marginBottom: 16,
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            background: "var(--accent)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 22,
            fontWeight: 800,
            color: "#fff",
            flexShrink: 0,
            boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
          }}
        >
          {user.avatarUrl ? (
            <Image
              src={user.avatarUrl}
              alt={u}
              width={64}
              height={64}
              style={{ borderRadius: "50%", objectFit: "cover" }}
            />
          ) : (
            initials
          )}
        </div>

        <div style={{ flex: 1, minWidth: 200 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
              marginBottom: 4,
            }}
          >
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text)", margin: 0 }}>
              {user.displayName ?? user.username}
            </h1>
            <span style={{ fontSize: 14, color: "var(--muted)" }}>@{u}</span>
            {user.tier !== "reader" && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  background: "var(--accent)",
                  color: "#fff",
                  borderRadius: 999,
                  padding: "2px 10px",
                  textTransform: "capitalize",
                }}
              >
                {user.tier.replace("_", " ")}
              </span>
            )}
          </div>

          <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 12px", lineHeight: 1.5 }}>
            <Link href={`/u/${encSeg(u)}/profile`} prefetch={false} style={{ color: "var(--accent)", fontWeight: 600, textDecoration: "none" }}>
              Profile & bio
            </Link>
            <span style={{ opacity: 0.5 }}> · </span>
            Public library below
          </p>

          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
            {stat(`/u/${encSeg(u)}/profile`, user._count.reviews, "Reviews")}
            {stat(`/u/${encSeg(u)}/followers`, user._count.followers, "Followers")}
            {stat(`/u/${encSeg(u)}/following`, user._count.following, "Following")}
            {stat(`/u/${encSeg(u)}#library`, user.shelves.length, "Shelves")}
          </div>

          {!isOwn && sessionUserId && (
            <ProfileSocialActions
              username={user.username}
              initialFollowing={initialFollowing}
              initialTheyFollowYou={initialTheyFollowYou}
              initialYouBlockedThem={initialYouBlockedThem}
            />
          )}
        </div>

        {isOwn && (
          <Link
            href="/settings"
            style={{
              padding: "8px 16px",
              borderRadius: 9,
              border: "1px solid var(--border)",
              background: "var(--surface)",
              color: "var(--muted)",
              fontSize: 13,
              textDecoration: "none",
              flexShrink: 0,
            }}
          >
            Edit profile
          </Link>
        )}
      </div>
    </div>
  );
}
