export type ChatLinkPreview = {
  kind: "book" | "browse" | "search" | "shelves" | "profile" | "publicShelf" | "userLibrary" | "generic";
  title: string;
  subtitle: string | null;
  /** Relative href for in-app navigation */
  href: string;
  imageUrl?: string | null;
  emoji?: string | null;
};
