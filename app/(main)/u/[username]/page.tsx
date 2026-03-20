import { notFound } from "next/navigation";
import { loadPublicUserWallPage } from "@/lib/social/loadPublicUserWall";
import PublicUserLibraryWall from "@/components/social/PublicUserLibraryWall";
import UserPublicShelvesHeader from "@/components/social/UserPublicShelvesHeader";
import { prisma } from "@/lib/prisma";

interface Props {
  params: Promise<{ username: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { username } = await params;
  const user = await prisma.user.findUnique({ where: { username }, select: { displayName: true } });
  return { title: user?.displayName ? `${user.displayName} (@${username}) · Library` : `@${username} · Library` };
}

export default async function PublicUserLibraryPage({ params }: Props) {
  const { username } = await params;
  const data = await loadPublicUserWallPage(username);
  if (!data) notFound();

  const {
    user,
    sessionUserId,
    isOwn,
    initialFollowing,
    initialTheyFollowYou,
    initialYouBlockedThem,
    libraryWall,
    wallAssignableShelves,
    hostAccentColour,
  } = data;
  const shelvesVisible = user.settings?.shelvesPublic !== false;

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "40px 24px 80px" }}>
      <UserPublicShelvesHeader
        user={user}
        sessionUserId={sessionUserId}
        isOwn={isOwn}
        initialFollowing={initialFollowing}
        initialTheyFollowYou={initialTheyFollowYou}
        initialYouBlockedThem={initialYouBlockedThem}
      />

      <div style={{ height: 1, background: "var(--border)", marginBottom: 32 }} />

      <section id="library" aria-label="Public library wall">
        {!shelvesVisible ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "var(--muted)", fontSize: 14 }}>
            This user&apos;s shelves are private.
          </div>
        ) : wallAssignableShelves.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "var(--muted)", fontSize: 14 }}>
            No public shelves yet.
          </div>
        ) : (
          <PublicUserLibraryWall
            initialWall={libraryWall}
            assignableShelves={wallAssignableShelves}
            profileUsername={user.username}
            hostAccentColour={hostAccentColour}
          />
        )}
      </section>
    </div>
  );
}
