import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getBlockedPeerIds } from "@/lib/social/blocking";
import { loadPublicUserAccess, visibleInFollowList } from "@/lib/social/loadPublicUserLibrary";

interface Props {
  params: Promise<{ username: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { username } = await params;
  const user = await prisma.user.findUnique({ where: { username }, select: { displayName: true } });
  return { title: user?.displayName ? `Followers · ${user.displayName}` : `Followers · @${username}` };
}

export default async function PublicFollowersPage({ params }: Props) {
  const { username } = await params;
  const access = await loadPublicUserAccess(username);
  if (!access) notFound();

  const { user, sessionUserId } = access;
  const blocked = sessionUserId ? await getBlockedPeerIds(sessionUserId) : new Set<string>();

  const rows = await prisma.follow.findMany({
    where: { followingId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      follower: {
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
          settings: { select: { profilePublic: true } },
        },
      },
    },
  });

  const members = rows
    .map((r) => r.follower)
    .filter((m) => !blocked.has(m.id))
    .filter((m) => visibleInFollowList(sessionUserId, user.id, m));

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "40px 24px 80px" }}>
      <Link href={`/u/${user.username}`} style={{ fontSize: 13, color: "var(--muted)", textDecoration: "none" }}>
        ← @{user.username}
      </Link>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text)", margin: "16px 0 8px" }}>Followers</h1>
      <p style={{ fontSize: 14, color: "var(--muted)", marginBottom: 24 }}>
        People who follow {user.displayName ?? `@${user.username}`}.
      </p>

      {members.length === 0 ? (
        <p style={{ fontSize: 14, color: "var(--muted)" }}>No followers to show yet.</p>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
          {members.map((m) => {
            const label = (m.displayName ?? m.username).slice(0, 2).toUpperCase();
            return (
              <li key={m.id}>
                <Link
                  href={`/u/${m.username}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    padding: "12px 14px",
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                    background: "var(--surface)",
                    textDecoration: "none",
                    color: "inherit",
                  }}
                >
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: "50%",
                      background: "var(--accent)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 14,
                      fontWeight: 700,
                      color: "#fff",
                      flexShrink: 0,
                      overflow: "hidden",
                    }}
                  >
                    {m.avatarUrl ? (
                      <Image src={m.avatarUrl} alt="" width={44} height={44} style={{ objectFit: "cover" }} />
                    ) : (
                      label
                    )}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, color: "var(--text)" }}>{m.displayName ?? m.username}</div>
                    <div style={{ fontSize: 13, color: "var(--muted)" }}>@{m.username}</div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
