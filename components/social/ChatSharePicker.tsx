"use client";

import { booksBrowseHref } from "@/lib/booksBrowseHref";
import { useTheme } from "@/components/ThemeProvider";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";

export type ChatSharePickerHandle = {
  handleKeyDown: (e: React.KeyboardEvent) => boolean;
};

type BookRow = { id: string; title: string; cover_url?: string; authors?: string[] };
type UserRow = { id: string; username: string; displayName: string | null; avatarUrl: string | null };
type ShelfRow = { slug: string; name: string; emoji: string | null };

export type ChatSharePickerMode =
  | { kind: "at"; query: string }
  | { kind: "slash"; query: string }
  | { kind: "menu"; tab: "books" | "authors" | "people"; query: string }
  | { kind: "user_shelves"; username: string; displayName: string | null };

type Props = {
  mode: ChatSharePickerMode;
  onCommit: (href: string) => void;
  onUserStep: (u: { username: string; displayName: string | null }) => void;
  onBackFromUser?: () => void;
  onClose: () => void;
};

const RowBtn = ({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) => (
  <button
    type="button"
    onClick={onClick}
    style={{
      display: "flex",
      alignItems: "center",
      gap: 10,
      width: "100%",
      textAlign: "left",
      padding: "8px 10px",
      border: "none",
      borderRadius: 8,
      background: active ? "var(--bg)" : "transparent",
      cursor: "pointer",
      color: "var(--text)",
      fontSize: 13,
      lineHeight: 1.35,
    }}
  >
    {children}
  </button>
);

export default forwardRef<ChatSharePickerHandle, Props>(function ChatSharePicker(
  { mode, onCommit, onUserStep, onBackFromUser, onClose },
  ref,
) {
  const { settings } = useTheme();
  const accent = settings.accentColour;
  const [books, setBooks] = useState<BookRow[]>([]);
  const [authors, setAuthors] = useState<{ id: string; name: string }[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [shelves, setShelves] = useState<ShelfRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [idx, setIdx] = useState(0);
  const reqId = useRef(0);

  const fetchAtOrMenuBooksAuthors = useCallback(async (query: string, signal: AbortSignal) => {
    const res = await fetch(`/api/chat/share-suggest?scope=at&q=${encodeURIComponent(query)}`, { signal });
    if (!res.ok) return;
    const data = (await res.json()) as { books?: BookRow[]; authors?: { id: string; name: string }[] };
    setBooks(Array.isArray(data.books) ? data.books.filter((b) => b.id) : []);
    setAuthors(Array.isArray(data.authors) ? data.authors : []);
  }, []);

  const fetchUsers = useCallback(async (query: string, signal: AbortSignal) => {
    if (query.length < 2) {
      setUsers([]);
      return;
    }
    const res = await fetch(`/api/chat/share-suggest?scope=user&q=${encodeURIComponent(query)}`, { signal });
    if (!res.ok) return;
    const data = (await res.json()) as { users?: UserRow[] };
    setUsers(Array.isArray(data.users) ? data.users : []);
  }, []);

  const fetchShelves = useCallback(async (username: string, signal: AbortSignal) => {
    const res = await fetch(
      `/api/chat/share-suggest?scope=shelves&shelvesFor=${encodeURIComponent(username)}`,
      { signal },
    );
    if (!res.ok) return;
    const data = (await res.json()) as { shelves?: ShelfRow[] };
    setShelves(Array.isArray(data.shelves) ? data.shelves : []);
  }, []);

  useEffect(() => {
    const id = ++reqId.current;
    const ac = new AbortController();
    setLoading(true);
    setIdx(0);

    (async () => {
      try {
        if (mode.kind === "user_shelves") {
          setBooks([]);
          setAuthors([]);
          setUsers([]);
          await fetchShelves(mode.username, ac.signal);
        } else if (mode.kind === "at") {
          setUsers([]);
          setShelves([]);
          await fetchAtOrMenuBooksAuthors(mode.query, ac.signal);
        } else if (mode.kind === "slash") {
          setBooks([]);
          setAuthors([]);
          setShelves([]);
          await fetchUsers(mode.query, ac.signal);
        } else if (mode.kind === "menu") {
          setShelves([]);
          if (mode.tab === "people") {
            setBooks([]);
            setAuthors([]);
            await fetchUsers(mode.query, ac.signal);
          } else if (mode.tab === "authors") {
            setUsers([]);
            if (mode.query.length < 2) {
              setBooks([]);
              setAuthors([]);
            } else {
              await fetchAtOrMenuBooksAuthors(mode.query, ac.signal);
            }
          } else {
            setUsers([]);
            if (mode.query.length < 1) {
              setBooks([]);
              setAuthors([]);
            } else {
              await fetchAtOrMenuBooksAuthors(mode.query, ac.signal);
            }
          }
        }
      } catch {
        if (!ac.signal.aborted) {
          setBooks([]);
          setAuthors([]);
          setUsers([]);
          setShelves([]);
        }
      } finally {
        if (reqId.current === id && !ac.signal.aborted) setLoading(false);
      }
    })();

    return () => {
      ac.abort();
    };
  }, [mode, fetchAtOrMenuBooksAuthors, fetchUsers, fetchShelves]);

  type Row =
    | { key: string; label: string; sub?: string; href: string }
    | { key: string; label: string; sub?: string; href: ""; user: UserRow };

  const rows: Row[] = useMemo(() => {
    if (mode.kind === "user_shelves") {
      const base: Row[] = [
        {
          key: "p",
          label: "Profile",
          sub: `@${mode.username}`,
          href: `/u/${encodeURIComponent(mode.username)}/profile`,
        },
        {
          key: "l",
          label: "Library",
          sub: "Shelves wall",
          href: `/u/${encodeURIComponent(mode.username)}`,
        },
      ];
      for (const s of shelves) {
        base.push({
          key: `s-${s.slug}`,
          label: s.name,
          sub: s.emoji ? `${s.emoji} · shelf` : "Shelf",
          href: `/u/${encodeURIComponent(mode.username)}/shelves/${encodeURIComponent(s.slug)}`,
        });
      }
      return base;
    }
    if (mode.kind === "slash" || (mode.kind === "menu" && mode.tab === "people")) {
      return users.map(
        (u): Row => ({
          key: u.id,
          label: u.displayName ?? u.username,
          sub: `@${u.username}`,
          href: "",
          user: u,
        }),
      );
    }
    if (mode.kind === "menu" && mode.tab === "authors") {
      return authors.map(
        (a): Row => ({
          key: a.id,
          label: a.name,
          sub: "Author · filtered browse",
          href: booksBrowseHref({ author: a.id }),
        }),
      );
    }
    if (mode.kind === "menu" && mode.tab === "books") {
      return books
        .filter((b) => b.id)
        .map(
          (b): Row => ({
            key: `b-${b.id}`,
            label: b.title,
            sub: b.authors?.length ? b.authors.join(", ") : "Book",
            href: `/books/${b.id}`,
          }),
        );
    }
    const out: Row[] = [];
    for (const a of authors) {
      out.push({
        key: `a-${a.id}`,
        label: a.name,
        sub: "Author",
        href: booksBrowseHref({ author: a.id }),
      });
    }
    for (const b of books) {
      if (!b.id) continue;
      out.push({
        key: `b-${b.id}`,
        label: b.title,
        sub: b.authors?.length ? b.authors.join(", ") : "Book",
        href: `/books/${b.id}`,
      });
    }
    return out;
  }, [mode, books, authors, users, shelves]);

  const activate = useCallback(
    (i: number) => {
      const r = rows[i];
      if (!r) return;
      if ("user" in r) {
        onUserStep({ username: r.user.username, displayName: r.user.displayName });
        return;
      }
      onCommit(r.href);
    },
    [rows, onCommit, onUserStep],
  );

  useImperativeHandle(
    ref,
    () => ({
      handleKeyDown(e: React.KeyboardEvent): boolean {
        if (e.key === "Escape") {
          if (mode.kind === "user_shelves" && onBackFromUser) {
            onBackFromUser();
            return true;
          }
          onClose();
          return true;
        }
        if (rows.length === 0) return false;
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setIdx((x) => Math.min(x + 1, rows.length - 1));
          return true;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setIdx((x) => Math.max(x - 1, 0));
          return true;
        }
        if (e.key === "Enter") {
          e.preventDefault();
          activate(idx);
          return true;
        }
        return false;
      },
    }),
    [rows.length, idx, activate, onClose],
  );

  const showHint =
    mode.kind === "at"
      ? "Books & authors"
      : mode.kind === "slash"
        ? "People"
        : mode.kind === "menu"
          ? mode.tab === "books"
            ? "Books"
            : mode.tab === "authors"
              ? "Authors"
              : "People"
          : `Share · @${mode.username}`;

  const hintQuery =
    mode.kind === "user_shelves" ? "" : mode.kind === "menu" ? mode.query : mode.query;

  return (
    <div
      style={{
        borderBottom: "1px solid var(--border)",
        padding: "8px 10px 10px",
        maxHeight: 280,
        overflowY: "auto",
        WebkitOverflowScrolling: "touch",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        {mode.kind === "user_shelves" && onBackFromUser && (
          <button
            type="button"
            onClick={onBackFromUser}
            style={{
              fontSize: 12,
              border: "none",
              background: "transparent",
              color: accent,
              cursor: "pointer",
              padding: "2px 0",
              fontWeight: 600,
            }}
          >
            ← Back
          </button>
        )}
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", color: accent, textTransform: "uppercase" }}>
          {showHint}
        </div>
      </div>
      {loading && <div style={{ fontSize: 12, color: "var(--muted)", padding: 6 }}>Loading…</div>}
      {!loading && mode.kind === "at" && hintQuery.length < 1 && (
        <div style={{ fontSize: 12, color: "var(--muted)", padding: 6, lineHeight: 1.45 }}>Type after @ to search books and authors.</div>
      )}
      {!loading && mode.kind === "menu" && mode.tab === "authors" && hintQuery.length < 2 && (
        <div style={{ fontSize: 12, color: "var(--muted)", padding: 6, lineHeight: 1.45 }}>Type at least two letters to search authors.</div>
      )}
      {!loading && mode.kind === "menu" && mode.tab === "books" && hintQuery.length < 1 && (
        <div style={{ fontSize: 12, color: "var(--muted)", padding: 6, lineHeight: 1.45 }}>Type to search books.</div>
      )}
      {!loading && mode.kind === "slash" && hintQuery.length < 2 && (
        <div style={{ fontSize: 12, color: "var(--muted)", padding: 6, lineHeight: 1.45 }}>Type at least two letters after /.</div>
      )}
      {!loading &&
        mode.kind === "menu" &&
        mode.tab === "people" &&
        hintQuery.length < 2 && (
          <div style={{ fontSize: 12, color: "var(--muted)", padding: 6, lineHeight: 1.45 }}>Type at least two letters to find people.</div>
        )}
      {!loading &&
        rows.length === 0 &&
        (mode.kind !== "at" || hintQuery.length >= 1) &&
        (mode.kind !== "slash" || hintQuery.length >= 2) &&
        mode.kind !== "user_shelves" &&
        !(mode.kind === "menu" && mode.tab === "authors" && hintQuery.length < 2) &&
        !(mode.kind === "menu" && mode.tab === "books" && hintQuery.length < 1) &&
        !(mode.kind === "menu" && mode.tab === "people" && hintQuery.length < 2) && (
          <div style={{ fontSize: 12, color: "var(--muted)", padding: 6 }}>No results</div>
        )}
      {!loading &&
        rows.map((r, i) => (
          <RowBtn key={r.key} active={i === idx} onClick={() => activate(i)}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontWeight: 600 }}>{r.label}</div>
              {r.sub && <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{r.sub}</div>}
            </div>
          </RowBtn>
        ))}
    </div>
  );
});
