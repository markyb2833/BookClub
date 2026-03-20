import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import { getWorksCommunityStatsMap, mergeWorkCommunityStats } from "@/lib/social/workCommunityStats";
import Link from "next/link";
import ShelfBookGrid from "@/components/shelves/ShelfBookGrid";
import { DEFAULT_SHELF_EMOJIS, accentBorder } from "@/lib/shelves/visual";

interface Props { params: Promise<{ slug: string }>; searchParams: Promise<{ sort?: string }> }

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const shelf = await prisma.shelf.findFirst({ where: { slug }, select: { name: true } });
  return { title: shelf?.name ?? "Shelf" };
}

export default async function ShelfPage({ params, searchParams }: Props) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { slug } = await params;
  const { sort = "recent" } = await searchParams;

  const shelf = await prisma.shelf.findFirst({
    where: { slug, userId: session.user.id },
    include: {
      books: {
        include: {
          work: {
            include: {
              workAuthors: { include: { author: true } },
              workGenres: { include: { genre: true } },
            },
          },
        },
      },
      _count: { select: { books: true } },
    },
  });

  if (!shelf) notFound();

  const commMap = await getWorksCommunityStatsMap(
    prisma,
    shelf.books.map((b) => b.work.id),
  );
  const enriched = shelf.books.map((b) => ({
    ...b,
    work: mergeWorkCommunityStats(b.work, commMap),
  }));

  const ratingKey = (w: (typeof enriched)[0]["work"]) =>
    w.communityRatingAvg > 0 ? w.communityRatingAvg : (w.averageRating ?? 0);

  // Sort books
  const books = [...enriched].sort((a, b) => {
    if (sort === "title") return a.work.title.localeCompare(b.work.title);
    if (sort === "author") {
      const aName = a.work.workAuthors[0]?.author.name ?? "";
      const bName = b.work.workAuthors[0]?.author.name ?? "";
      return aName.localeCompare(bName);
    }
    if (sort === "rating") return ratingKey(b.work) - ratingKey(a.work);
    if (sort === "order") return a.sortOrder - b.sortOrder;
    return new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime();
  });

  const emoji = shelf.emoji ?? DEFAULT_SHELF_EMOJIS[shelf.slug] ?? "📚";
  const shelfAccent = shelf.accentColour ?? "var(--accent)";
  const shelfBg = shelf.bgColour ?? null;
  const titleColor = shelf.titleColour ?? "var(--text)";
  const headerBorder = shelf.accentColour ? accentBorder(shelf.accentColour, 0.4) : "var(--border)";
  const sortOptions = [
    { value: "order", label: "Shelf order" },
    { value: "recent", label: "Recently added" },
    { value: "title", label: "Title A–Z" },
    { value: "author", label: "Author A–Z" },
    { value: "rating", label: "Top rated" },
  ];

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 24px 80px" }}>

      {/* Back */}
      <Link href="/shelves" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--muted)", textDecoration: "none", marginBottom: 24 }}>
        ← My Library
      </Link>

      {/* Shelf header — uses per-shelf colours from library customisation */}
      <div
        style={{
          marginBottom: 32,
          position: "relative",
          borderRadius: 20,
          border: `1.5px solid ${headerBorder}`,
          background: shelfBg ?? "var(--surface)",
          padding: "24px 28px",
          boxShadow: shelf.accentColour ? `0 12px 40px ${shelf.accentColour}12` : "none",
          overflow: "hidden",
        }}
      >
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: shelfAccent, opacity: 0.85, borderRadius: "20px 0 0 20px" }} />
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap", paddingLeft: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ fontSize: 48, lineHeight: 1, filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.15))" }}>{emoji}</div>
            <div>
              <h1 style={{ fontSize: 28, fontWeight: 800, color: titleColor, margin: 0, letterSpacing: "-0.3px" }}>{shelf.name}</h1>
              <p style={{ fontSize: 14, color: "var(--muted)", margin: "4px 0 0" }}>
                {shelf._count.books} book{shelf._count.books !== 1 ? "s" : ""}
                {!shelf.isPublic && <span style={{ marginLeft: 8, fontSize: 11, background: "var(--border)", borderRadius: 5, padding: "2px 7px", color: "var(--muted)" }}>private</span>}
              </p>
            </div>
          </div>

          {/* Sort */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {sortOptions.map((o) => {
              const active = sort === o.value;
              return (
                <Link
                  key={o.value}
                  href={`/shelves/${slug}?sort=${o.value}`}
                  style={{
                    padding: "6px 13px",
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 500,
                    textDecoration: "none",
                    border: `1px solid ${active ? shelfAccent : "var(--border)"}`,
                    background: active ? shelfAccent : "var(--bg)",
                    color: active ? "#fff" : "var(--muted)",
                    transition: "all 0.15s",
                  }}
                >
                  {o.label}
                </Link>
              );
            })}
          </div>
        </div>

        {shelf.description && (
          <p style={{ fontSize: 14, color: "var(--muted)", marginTop: 14, lineHeight: 1.65, maxWidth: 640, paddingLeft: 8 }}>{shelf.description}</p>
        )}
      </div>

      {/* Book grid */}
      <ShelfBookGrid books={books} emoji={emoji} accentColour={shelf.accentColour} />
    </div>
  );
}
