import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { loadPublicUserLibrary } from "@/lib/social/loadPublicUserLibrary";
import { publicShelfHref } from "@/lib/social/publicShelfUrl";
import { DEFAULT_SHELF_EMOJIS } from "@/lib/shelves/visual";
import ProfileSocialActions from "@/components/social/ProfileSocialActions";

interface Props {
  params: Promise<{ username: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { username } = await params;
  const user = await prisma.user.findUnique({ where: { username }, select: { displayName: true } });
  return { title: user?.displayName ? `${user.displayName} (@${username})` : `@${username}` };
}

export default async function PublicUserProfilePage({ params }: Props) {
  const { username } = await params;
  const data = await loadPublicUserLibrary(username);
  if (!data) notFound();

  const { user, sessionUserId, isOwn, initialFollowing, initialTheyFollowYou, initialYouBlockedThem } = data;
  const initials = (user.displayName ?? user.username).slice(0, 2).toUpperCase();
  const u = user.username;
  const shelvesVisible = user.settings?.shelvesPublic !== false;
  const libraryHref = `/u/${encodeURIComponent(u)}#library`;

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
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "40px 24px 80px" }}>
      <Link
        href={`/u/${encodeURIComponent(u)}`}
        style={{ fontSize: 13, color: "var(--muted)", textDecoration: "none", display: "inline-block", marginBottom: 20 }}
      >
        ← {user.displayName ?? user.username}&apos;s library
      </Link>

      <div
        style={{
          display: "flex",
          gap: 24,
          marginBottom: 32,
          flexWrap: "wrap",
          alignItems: "flex-start",
        }}
      >
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: "50%",
            background: "var(--accent)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 28,
            fontWeight: 800,
            color: "#fff",
            flexShrink: 0,
            boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
          }}
        >
          {user.avatarUrl ? (
            <Image src={user.avatarUrl} alt={u} width={80} height={80} style={{ borderRadius: "50%", objectFit: "cover" }} />
          ) : (
            initials
          )}
        </div>

        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 6 }}>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--text)", margin: 0 }}>
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

          {user.bio && (
            <p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.6, marginBottom: 12, maxWidth: 520 }}>{user.bio}</p>
          )}

          <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
            {stat(`/u/${encodeURIComponent(u)}/profile`, user._count.reviews, "Reviews")}
            {stat(`/u/${encodeURIComponent(u)}/followers`, user._count.followers, "Followers")}
            {stat(`/u/${encodeURIComponent(u)}/following`, user._count.following, "Following")}
            {stat(libraryHref, user.shelves.length, "Shelves")}
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

      <div style={{ height: 1, background: "var(--border)", margin: "28px 0 24px" }} />

      <h2
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: "var(--muted)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          marginBottom: 12,
        }}
      >
        Public shelves
      </h2>
      {!shelvesVisible ? (
        <p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.55 }}>This user&apos;s shelves are private.</p>
      ) : user.shelves.length === 0 ? (
        <p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.55 }}>No public shelves yet.</p>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
          {user.shelves.map((shelf) => {
            const emoji = shelf.emoji ?? DEFAULT_SHELF_EMOJIS[shelf.slug] ?? "📚";
            const href = publicShelfHref(u, shelf.slug);
            return (
              <li key={shelf.id}>
                <Link
                  href={href}
                  prefetch={false}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 14px",
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                    background: "var(--surface)",
                    textDecoration: "none",
                    color: "inherit",
                  }}
                >
                  <span style={{ fontSize: 22, lineHeight: 1 }}>{emoji}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, color: "var(--text)", fontSize: 15 }}>{shelf.name}</div>
                    <div style={{ fontSize: 13, color: "var(--muted)" }}>
                      {shelf._count.books} book{shelf._count.books !== 1 ? "s" : ""} · open shelf
                    </div>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--accent)", flexShrink: 0 }}>→</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 20 }}>
        <Link href={libraryHref} style={{ color: "var(--accent)", fontWeight: 600, textDecoration: "none" }}>
          Decorated library wall
        </Link>{" "}
        (how they arranged their public shelves)
      </p>
    </div>
  );
}
