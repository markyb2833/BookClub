"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import ReaderCommunitySignals from "@/components/books/ReaderCommunitySignals";
import ShelfPopover from "@/components/shelves/ShelfPopover";
import { ZERO_COMMUNITY_STATS, type WorkCommunityStats } from "@/lib/social/workCommunityStats";

interface Hit {
  id: string;
  title: string;
  subtitle?: string;
  cover_url?: string;
  authors?: string[];
  genres?: string[];
  average_rating?: number;
  ratings_count?: number;
  first_published?: number;
  description?: string;
}

function SearchResult({ hit, community }: { hit: Hit; community: WorkCommunityStats }) {
  return (
    <div style={{ position: "relative" }}>
      <Link
        href={`/books/${hit.id}`}
        className="search-result-card"
        style={{
          display: "flex",
          gap: 16,
          background: "var(--surface)",
          borderRadius: 12,
          border: "1px solid var(--border)",
          padding: "16px 52px 16px 16px",
          textDecoration: "none",
          transition: "box-shadow 0.15s",
        }}
      >
        <style>{`.search-result-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.1); }`}</style>
        <div style={{ width: 72, height: 108, borderRadius: 6, overflow: "hidden", flexShrink: 0, background: "var(--border)", position: "relative" }}>
          {hit.cover_url ? (
            <Image src={hit.cover_url} alt={hit.title} fill style={{ objectFit: "cover" }} sizes="72px" />
          ) : (
            <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: 8 }}>
              <span style={{ fontSize: 11, color: "var(--muted)", textAlign: "center", lineHeight: 1.3 }}>{hit.title.slice(0, 24)}</span>
            </div>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0, flex: 1 }}>
          <div>
            <div style={{ fontWeight: 600, color: "var(--text)", fontSize: 15, lineHeight: 1.3 }}>{hit.title}</div>
            {hit.subtitle && <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 1 }}>{hit.subtitle}</div>}
          </div>
          <div style={{ fontSize: 13, color: "var(--muted)" }}>
            {hit.authors?.join(", ")}
            {hit.first_published && <span> · {hit.first_published}</span>}
          </div>
          <ReaderCommunitySignals
            compact
            community={community}
            openLibraryRating={hit.average_rating ?? 0}
            openLibraryRatingsCount={hit.ratings_count ?? 0}
          />
          {hit.genres && hit.genres.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 2 }}>
              {hit.genres.slice(0, 3).map((g) => (
                <span key={g} style={{ fontSize: 11, background: "var(--bg)", color: "var(--muted)", borderRadius: 999, padding: "2px 10px", border: "1px solid var(--border)" }}>
                  {g}
                </span>
              ))}
            </div>
          )}
          {hit.description && (
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2, lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
              {hit.description}
            </div>
          )}
        </div>
      </Link>
      <div style={{ position: "absolute", top: 12, right: 12, zIndex: 2 }}>
        <ShelfPopover workId={hit.id} />
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div style={{ display: "flex", gap: 16, background: "var(--surface)", borderRadius: 12, border: "1px solid var(--border)", padding: 16 }}>
      <div style={{ width: 72, height: 108, borderRadius: 6, background: "var(--border)", flexShrink: 0 }} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8, paddingTop: 4 }}>
        <div style={{ height: 16, background: "var(--border)", borderRadius: 4, width: "65%" }} />
        <div style={{ height: 13, background: "var(--border)", borderRadius: 4, width: "40%" }} />
        <div style={{ height: 12, background: "var(--border)", borderRadius: 4, width: "30%" }} />
        <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
          <div style={{ height: 20, background: "var(--border)", borderRadius: 999, width: 56 }} />
          <div style={{ height: 20, background: "var(--border)", borderRadius: 999, width: 72 }} />
        </div>
      </div>
    </div>
  );
}

interface UserHit {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

function PeopleSkeleton() {
  return (
    <div style={{ display: "flex", gap: 14, background: "var(--surface)", borderRadius: 12, border: "1px solid var(--border)", padding: 14 }}>
      <div style={{ width: 44, height: 44, borderRadius: "50%", background: "var(--border)", flexShrink: 0 }} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8, justifyContent: "center" }}>
        <div style={{ height: 15, background: "var(--border)", borderRadius: 4, width: "45%" }} />
        <div style={{ height: 12, background: "var(--border)", borderRadius: 4, width: "30%" }} />
      </div>
    </div>
  );
}

function UserSearchResult({ u }: { u: UserHit }) {
  const initials = (u.displayName ?? u.username).slice(0, 2).toUpperCase();
  return (
    <Link
      href={`/u/${encodeURIComponent(u.username)}`}
      className="search-result-card"
      style={{
        display: "flex",
        gap: 14,
        background: "var(--surface)",
        borderRadius: 12,
        border: "1px solid var(--border)",
        padding: 14,
        textDecoration: "none",
        transition: "box-shadow 0.15s",
        alignItems: "center",
      }}
    >
      <style>{`.search-result-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.1); }`}</style>
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: "50%",
          flexShrink: 0,
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 13,
          fontWeight: 700,
          color: "#fff",
          background: "var(--accent)",
        }}
      >
        {u.avatarUrl ? (
          <Image src={u.avatarUrl} alt="" width={44} height={44} style={{ objectFit: "cover" }} />
        ) : (
          initials
        )}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 600, color: "var(--text)", fontSize: 15 }}>{u.displayName ?? u.username}</div>
        <div style={{ fontSize: 13, color: "var(--muted)" }}>@{u.username}</div>
      </div>
    </Link>
  );
}

const POPULAR_SEARCHES = [
  "Harry Potter", "Dune", "The Hobbit", "1984",
  "Pride and Prejudice", "The Great Gatsby", "To Kill a Mockingbird",
  "Lord of the Rings", "Sherlock Holmes",
];

type SearchTab = "books" | "people";

export default function SearchClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const initialQ = searchParams.get("q") ?? "";
  const initialTab: SearchTab = searchParams.get("tab") === "people" ? "people" : "books";
  const [query, setQuery] = useState(initialQ);
  const [committedQuery, setCommittedQuery] = useState(initialQ);
  const [tab, setTab] = useState<SearchTab>(initialTab);
  const [hits, setHits] = useState<Hit[]>([]);
  const [total, setTotal] = useState(0);
  const [users, setUsers] = useState<UserHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [communityById, setCommunityById] = useState<Record<string, WorkCommunityStats>>({});

  const pushSearchUrl = useCallback(
    (q: string, nextTab: SearchTab) => {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (nextTab === "people") params.set("tab", "people");
      const s = params.toString();
      router.replace(s ? `/search?${s}` : "/search", { scroll: false });
    },
    [router],
  );

  const doBookSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setHits([]);
      setTotal(0);
      setCommunityById({});
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setHits(data.hits ?? []);
      setTotal(data.total ?? 0);
    } catch {
      // keep stale results
    }
    setLoading(false);
  }, []);

  const doPeopleSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setUsers([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`);
      const data = (await res.json()) as { users?: UserHit[] };
      setUsers(data.users ?? []);
    } catch {
      setUsers([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (tab !== "books" || hits.length === 0) {
      if (tab !== "books") setCommunityById({});
      return;
    }
    const ids = hits.map((h) => h.id).filter(Boolean);
    let cancelled = false;
    void fetch("/api/works/community-stats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workIds: ids }),
    })
      .then((r) => r.json())
      .then((d: { byId?: Record<string, WorkCommunityStats> }) => {
        if (!cancelled) setCommunityById(d.byId ?? {});
      })
      .catch(() => {
        if (!cancelled) setCommunityById({});
      });
    return () => {
      cancelled = true;
    };
  }, [hits, tab]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (tab === "books") {
      if (!query.trim()) {
        setHits([]);
        setTotal(0);
        setCommunityById({});
        setLoading(false);
        pushSearchUrl("", tab);
        return;
      }
      setLoading(true);
      debounceRef.current = setTimeout(() => {
        setCommittedQuery(query);
        pushSearchUrl(query, tab);
        void doBookSearch(query);
      }, 500);
    } else {
      if (query.trim().length < 2) {
        setUsers([]);
        setLoading(false);
        pushSearchUrl(query, tab);
        return;
      }
      setLoading(true);
      debounceRef.current = setTimeout(() => {
        setCommittedQuery(query);
        pushSearchUrl(query, tab);
        void doPeopleSearch(query);
      }, 500);
    }
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, tab, doBookSearch, doPeopleSearch, pushSearchUrl]);

  useEffect(() => {
    if (initialQ) {
      setCommittedQuery(initialQ);
      if (initialTab === "books") void doBookSearch(initialQ);
      else if (initialQ.trim().length >= 2) void doPeopleSearch(initialQ);
    }
    inputRef.current?.focus();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "40px 24px 80px" }}>

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>Search</h1>
        <p style={{ fontSize: 14, color: "var(--muted)" }}>
          {tab === "books" ? "Find your next read from millions of titles" : "Find readers by name or @username (two or more characters)"}
        </p>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {(["books", "people"] as const).map((t) => {
          const active = tab === t;
          return (
            <button
              key={t}
              type="button"
              onClick={() => {
                setTab(t);
                pushSearchUrl(query, t);
              }}
              style={{
                padding: "8px 16px",
                borderRadius: 999,
                border: active ? "1.5px solid var(--accent)" : "1.5px solid var(--border)",
                background: active ? "var(--surface)" : "transparent",
                color: active ? "var(--text)" : "var(--muted)",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {t === "books" ? "Books" : "People"}
            </button>
          );
        })}
      </div>

      {/* Search input */}
      <div style={{ position: "relative", marginBottom: 28 }}>
        <svg
          style={{
            position: "absolute",
            left: 16,
            top: "50%",
            transform: "translateY(-50%)",
            width: 18,
            height: 18,
            color: "#a8a29e",
            pointerEvents: "none",
          }}
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <circle cx="11" cy="11" r="8" />
          <path strokeLinecap="round" d="m21 21-4.35-4.35" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={tab === "books" ? "Search by title, author, or keyword…" : "Search people by name or @username…"}
          style={{
            width: "100%",
            boxSizing: "border-box",
            borderRadius: 14,
            border: "1.5px solid var(--border)",
            background: "var(--surface)",
            paddingLeft: 46,
            paddingRight: query ? 42 : 18,
            paddingTop: 14,
            paddingBottom: 14,
            fontSize: 15,
            color: "var(--text)",
            outline: "none",
            boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
            transition: "border-color 0.15s, box-shadow 0.15s",
          }}
          onFocus={(e) => {
            e.target.style.borderColor = "var(--muted)";
            e.target.style.boxShadow = "0 0 0 3px rgba(168,162,158,0.15), 0 1px 4px rgba(0,0,0,0.06)";
          }}
          onBlur={(e) => {
            e.target.style.borderColor = "var(--border)";
            e.target.style.boxShadow = "0 1px 4px rgba(0,0,0,0.06)";
          }}
        />
        {query && (
          <button
            onClick={() => {
              setQuery("");
              setHits([]);
              setTotal(0);
              setUsers([]);
              pushSearchUrl("", tab);
              inputRef.current?.focus();
            }}
            style={{
              position: "absolute",
              right: 14,
              top: "50%",
              transform: "translateY(-50%)",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 4,
              color: "var(--muted)",
              display: "flex",
              alignItems: "center",
            }}
          >
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Empty state — popular searches (books only) */}
      {!query && !loading && tab === "books" && (
        <div>
          <p style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 12 }}>
            Popular searches
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {POPULAR_SEARCHES.map((s) => (
              <button
                key={s}
                onClick={() => setQuery(s)}
                style={{
                  fontSize: 13,
                  background: "var(--surface)",
                  border: "1.5px solid var(--border)",
                  color: "var(--text)",
                  borderRadius: 999,
                  padding: "7px 16px",
                  cursor: "pointer",
                  transition: "border-color 0.15s",
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {!query && !loading && tab === "people" && (
        <p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.5 }}>
          Type at least two letters to search public profiles. You can open someone&apos;s library from here or add them when creating a group chat.
        </p>
      )}

      {/* Loading skeletons */}
      {loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[0, 1, 2, 3].map((i) =>
            tab === "books" ? <Skeleton key={i} /> : <PeopleSkeleton key={i} />,
          )}
        </div>
      )}

      {/* Book results */}
      {!loading && tab === "books" && hits.length > 0 && (
        <>
          <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 14 }}>
            {total.toLocaleString()} result{total !== 1 ? "s" : ""} for{" "}
            <span style={{ color: "var(--text)", fontWeight: 500 }}>"{committedQuery}"</span>
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {hits.map((hit) => (
              <SearchResult key={hit.id} hit={hit} community={communityById[hit.id] ?? ZERO_COMMUNITY_STATS} />
            ))}
          </div>
        </>
      )}

      {/* People results */}
      {!loading && tab === "people" && users.length > 0 && (
        <>
          <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 14 }}>
            {users.length} profile{users.length !== 1 ? "s" : ""} for{" "}
            <span style={{ color: "var(--text)", fontWeight: 500 }}>"{committedQuery}"</span>
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {users.map((u) => (
              <UserSearchResult key={u.id} u={u} />
            ))}
          </div>
        </>
      )}

      {/* No book results */}
      {!loading && tab === "books" && query.trim() && hits.length === 0 && (
        <div style={{ textAlign: "center", padding: "60px 0" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📚</div>
          <p style={{ fontWeight: 600, color: "var(--text)", marginBottom: 6 }}>
            No results for "{query}"
          </p>
          <p style={{ fontSize: 14, color: "var(--muted)" }}>
            Try a different title, author name, or keyword
          </p>
        </div>
      )}

      {/* No people results */}
      {!loading && tab === "people" && query.trim().length >= 2 && users.length === 0 && (
        <div style={{ textAlign: "center", padding: "60px 0" }}>
          <p style={{ fontWeight: 600, color: "var(--text)", marginBottom: 6 }}>
            No people matching "{query}"
          </p>
          <p style={{ fontSize: 14, color: "var(--muted)" }}>Try another spelling or partial @username</p>
        </div>
      )}
    </div>
  );
}
