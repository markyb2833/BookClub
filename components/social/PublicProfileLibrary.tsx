import Image from "next/image";
import Link from "next/link";
import { DEFAULT_SHELF_EMOJIS, accentBorder, spineColour } from "@/lib/shelves/visual";
import type { PublicUserWithLibrary } from "@/lib/social/loadPublicUserLibrary";
import { PREVIEW_BOOKS } from "@/lib/social/loadPublicUserLibrary";
import { publicShelfHref } from "@/lib/social/publicShelfUrl";

export default function PublicProfileLibrary({
  user,
  shelvesVisible,
}: {
  user: PublicUserWithLibrary;
  shelvesVisible: boolean;
}) {
  if (!shelvesVisible) {
    return (
      <div style={{ textAlign: "center", padding: "40px 0", color: "var(--muted)", fontSize: 14 }}>
        This user&apos;s shelves are private.
      </div>
    );
  }
  if (user.shelves.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "40px 0", color: "var(--muted)", fontSize: 14 }}>
        No public shelves yet.
      </div>
    );
  }

  return (
    <div>
      <h2
        id="library"
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: "var(--muted)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          marginBottom: 16,
        }}
      >
        Library
      </h2>
      <p style={{ fontSize: 14, color: "var(--muted)", margin: "-8px 0 20px", lineHeight: 1.5, maxWidth: 520 }}>
        Click anywhere on a shelf to open it — covers link to each book.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {user.shelves.map((shelf) => {
          const emoji = shelf.emoji ?? DEFAULT_SHELF_EMOJIS[shelf.slug] ?? "📚";
          const accent = shelf.accentColour;
          const borderCol = accent ? accentBorder(accent, 0.38) : "var(--border)";
          const linkCol = accent ?? "var(--accent)";
          const barCol = accent ?? "var(--accent)";
          const shelfUrl = publicShelfHref(user.username, shelf.slug);
          return (
            <div
              key={shelf.id}
              style={{
                position: "relative",
                background: shelf.bgColour ?? "var(--surface)",
                border: `1.5px solid ${borderCol}`,
                borderRadius: 18,
                padding: "18px 20px 18px 22px",
                boxShadow: accent ? `0 10px 36px ${accent}14` : "0 4px 24px rgba(0,0,0,0.04)",
              }}
            >
              {/* Full-card target: sits behind content; book strip opts back into pointer events */}
              <Link
                href={shelfUrl}
                prefetch={false}
                aria-label={`Open shelf: ${shelf.name}`}
                style={{
                  position: "absolute",
                  inset: 0,
                  zIndex: 0,
                  borderRadius: 18,
                }}
              >
                <span style={{ position: "absolute", inset: 0, opacity: 0 }} aria-hidden>
                  .
                </span>
              </Link>

              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: 4,
                  background: barCol,
                  opacity: 0.88,
                  borderRadius: "18px 0 0 18px",
                  zIndex: 1,
                  pointerEvents: "none",
                }}
              />

              <div style={{ position: "relative", zIndex: 2, pointerEvents: "none" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: 14,
                    flexWrap: "wrap",
                    marginBottom: shelf.description ? 10 : 12,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 12, minWidth: 0, flex: 1 }}>
                    <span style={{ fontSize: 26, lineHeight: 1, flexShrink: 0 }}>{emoji}</span>
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 16,
                          fontWeight: 700,
                          color: shelf.titleColour ?? "var(--text)",
                          letterSpacing: "-0.02em",
                        }}
                      >
                        {shelf.name}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>
                        {shelf._count.books} book{shelf._count.books !== 1 ? "s" : ""}
                      </div>
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: linkCol,
                      whiteSpace: "nowrap",
                      padding: "6px 12px",
                      borderRadius: 8,
                      border: `1px solid ${accent ? accentBorder(accent, 0.45) : "var(--border)"}`,
                      background: "var(--bg)",
                    }}
                  >
                    View shelf →
                  </span>
                </div>

                {shelf.description && (
                  <p
                    style={{
                      fontSize: 13,
                      color: "var(--muted)",
                      lineHeight: 1.55,
                      margin: "0 0 14px",
                      maxWidth: 640,
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {shelf.description}
                  </p>
                )}

                {shelf.books.length > 0 ? (
                  <div
                    style={{
                      display: "flex",
                      gap: 10,
                      overflowX: "auto",
                      paddingBottom: 6,
                      marginTop: 2,
                      position: "relative",
                      zIndex: 3,
                      pointerEvents: "auto",
                    }}
                  >
                    {shelf.books.map(({ work }, i) => (
                      <Link
                        key={work.id}
                        href={`/books/${work.id}`}
                        className="profile-shelf-cover-link"
                        style={{ flexShrink: 0, textDecoration: "none" }}
                      >
                        <div
                          className="profile-shelf-cover-inner"
                          style={{
                            width: 58,
                            height: 88,
                            borderRadius: 7,
                            overflow: "hidden",
                            background: work.coverUrl ? "var(--border)" : spineColour(work.title, i),
                            position: "relative",
                            boxShadow: "0 3px 12px rgba(0,0,0,0.12)",
                          }}
                        >
                          {work.coverUrl ? (
                            <Image src={work.coverUrl} alt={work.title} fill style={{ objectFit: "cover" }} sizes="58px" />
                          ) : (
                            <div
                              style={{
                                width: "100%",
                                height: "100%",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                padding: 5,
                              }}
                            >
                              <span
                                style={{
                                  fontSize: 9,
                                  fontWeight: 600,
                                  color: "#fff",
                                  textAlign: "center",
                                  textShadow: "0 1px 2px rgba(0,0,0,0.5)",
                                  lineHeight: 1.2,
                                }}
                              >
                                {work.title.slice(0, 18)}
                              </span>
                            </div>
                          )}
                        </div>
                      </Link>
                    ))}
                    {shelf._count.books > PREVIEW_BOOKS && (
                      <Link
                        href={shelfUrl}
                        style={{
                          width: 58,
                          height: 88,
                          borderRadius: 7,
                          background: accent ? accentBorder(accent, 0.12) : "var(--border)",
                          border: `1px dashed ${borderCol}`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          textDecoration: "none",
                        }}
                      >
                        <span style={{ fontSize: 12, color: linkCol, fontWeight: 700 }}>
                          +{shelf._count.books - PREVIEW_BOOKS}
                        </span>
                      </Link>
                    )}
                  </div>
                ) : (
                  <span style={{ fontSize: 12, color: "var(--muted)", fontStyle: "italic" }}>Empty shelf</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
