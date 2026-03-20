"use client";

import LibraryWall from "@/components/shelves/LibraryWall";
import type { LibraryShelf } from "@/lib/shelves/libraryShelfTypes";
import type { WallSlots } from "@/lib/shelves/libraryWall";

const noop = () => {};

export default function PublicUserLibraryWall({
  initialWall,
  assignableShelves,
  profileUsername,
  hostAccentColour,
}: {
  initialWall: { cols: number; rows: number; slots: WallSlots };
  assignableShelves: LibraryShelf[];
  profileUsername: string;
  hostAccentColour: string;
}) {
  return (
    <LibraryWall
      initialWall={initialWall}
      assignableShelves={assignableShelves}
      siteAccent={hostAccentColour}
      profileUsername={profileUsername}
      visitorPreview
      onBookMove={noop}
      onColourChange={noop}
      onLightingChange={noop}
      onTierCountChange={noop}
    />
  );
}
