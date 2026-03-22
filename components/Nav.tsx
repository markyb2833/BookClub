"use client";

import Link from "next/link";
import { Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useTheme } from "./ThemeProvider";
import { useMessagesDock } from "./social/MessagesDock";
import { UnreadCountBadge, useUnreadMessages } from "./social/UnreadMessagesContext";
import NavBooksLink from "./NavBooksLink";

type NavLink = (typeof baseLinks)[number];
const baseLinks = [
  {
    href: "/",
    label: "Home",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ),
  },
  {
    href: "/books",
    label: "Books",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
      </svg>
    ),
  },
  {
    href: "/shelves",
    label: "Library",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="4" height="18" rx="1"/><rect x="9" y="3" width="4" height="18" rx="1"/><rect x="16" y="3" width="6" height="18" rx="1"/>
      </svg>
    ),
  },
  {
    href: "/reading",
    label: "Reading",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
    ),
  },
  {
    href: "/search",
    label: "Search",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
    ),
  },
  {
    href: "/feed",
    label: "Discover",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 11a9 9 0 0 1 9 9"/><path d="M4 4a16 16 0 0 1 16 16"/><circle cx="5" cy="19" r="1"/>
      </svg>
    ),
  },
  {
    href: "/messages",
    label: "Messages",
    authOnly: true as const,
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    ),
  },
  {
    href: "/clubs",
    label: "Clubs",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
] as const;

function resolveNavHref(l: NavLink, hasSession: boolean): string {
  if (l.href === "/" && hasSession) return "/feed";
  if (l.href === "/feed") return "/feed?view=all";
  return l.href;
}

function navItemActive(l: NavLink, pathname: string, feedDiscover: boolean, hasSession: boolean): boolean {
  if (l.href === "/") {
    if (!hasSession) return pathname === "/";
    return pathname === "/feed" && !feedDiscover;
  }
  if (l.href === "/feed") {
    return pathname === "/feed" && feedDiscover;
  }
  const resolved = resolveNavHref(l, hasSession);
  if (pathname === resolved) return true;
  return pathname.startsWith(`${l.href}/`);
}

function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  const { settings } = useTheme();
  const initials = name.slice(0, 2).toUpperCase();
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: settings.accentColour,
      color: "#fff",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.38, fontWeight: 700, flexShrink: 0,
      userSelect: "none",
    }}>
      {initials}
    </div>
  );
}

function NavContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const feedDiscover = searchParams.get("view") === "all";
  const { data: session } = useSession();
  const { settings } = useTheme();
  const messagesDock = useMessagesDock();
  const { unreadTotal } = useUnreadMessages();

  const isDark = settings.theme === "dark";
  const bg      = isDark ? "#1a1a1a" : "#ffffff";
  const border  = isDark ? "#2a2a2a" : "#e7e5e4";
  const active  = isDark ? "#2a2a2a" : "#f5f5f4";
  const activeTxt = isDark ? "#f5f5f4" : "#1c1917";
  const inactiveTxt = isDark ? "#737373" : "#78716c";

  const userName = session?.user?.name ?? session?.user?.username ?? "";
  const links: NavLink[] = baseLinks.filter((l) => !("authOnly" in l && l.authOnly) || session?.user);

  return (
    <>
      {/* Desktop sidebar */}
      <aside style={{
        display: "none",
        position: "fixed", inset: "0 auto 0 0", width: 220,
        flexDirection: "column",
        borderRight: `1px solid ${border}`,
        background: bg,
        padding: "24px 12px",
        gap: 2,
      }}
        className="md-sidebar"
      >
        <style>{`@media (min-width: 768px) { .md-sidebar { display: flex !important; } }`}</style>

        <Link href="/" style={{ fontSize: 19, fontWeight: 800, color: activeTxt, marginBottom: 20, paddingLeft: 12, textDecoration: "none", letterSpacing: "-0.3px" }}>
          BookClub
        </Link>

        {links.map((l) => {
          const resolvedHref = resolveNavHref(l, !!session?.user);
          const isActive = navItemActive(l, pathname, feedDiscover, !!session?.user);
          const isMessages = l.href === "/messages";
          const msgBadge = isMessages && session?.user && unreadTotal > 0;
          if (l.href === "/books") {
            return (
              <Suspense
                key={l.href}
                fallback={
                  <Link
                    href="/books"
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      borderRadius: 9, padding: "9px 12px",
                      fontSize: 14, fontWeight: 500,
                      textDecoration: "none",
                      color: isActive ? activeTxt : inactiveTxt,
                      background: isActive ? active : "transparent",
                      transition: "background 0.1s, color 0.1s",
                    }}
                  >
                    {l.icon}
                    <span style={{ flex: 1, minWidth: 0 }}>{l.label}</span>
                  </Link>
                }
              >
                <NavBooksLink
                  variant="sidebar"
                  isActive={isActive}
                  activeTxt={activeTxt}
                  inactiveTxt={inactiveTxt}
                  activeBg={active}
                  icon={l.icon}
                  label={l.label}
                />
              </Suspense>
            );
          }
          return (
            <Link
              key={l.href}
              href={resolvedHref}
              onClick={(e) => {
                if (!isMessages || !session?.user) return;
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                e.preventDefault();
                messagesDock.goInbox();
                messagesDock.open();
              }}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                borderRadius: 9, padding: "9px 12px",
                fontSize: 14, fontWeight: 500,
                textDecoration: "none",
                color: isActive ? activeTxt : inactiveTxt,
                background: isActive ? active : "transparent",
                transition: "background 0.1s, color 0.1s",
              }}
            >
              {l.icon}
              <span style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, minWidth: 0 }}>
                <span>{l.label}</span>
                {msgBadge ? <UnreadCountBadge count={unreadTotal} /> : null}
              </span>
            </Link>
          );
        })}

        {/* Bottom: user area */}
        <div style={{ marginTop: "auto", borderTop: `1px solid ${border}`, paddingTop: 14, display: "flex", flexDirection: "column", gap: 2 }}>
          {session?.user ? (
            <>
              <Link
                href="/settings"
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  borderRadius: 9, padding: "9px 12px",
                  textDecoration: "none",
                  background: pathname.startsWith("/settings") ? active : "transparent",
                  transition: "background 0.1s",
                }}
              >
                <Avatar name={userName} size={28} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: activeTxt, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {userName}
                  </div>
                  <div style={{ fontSize: 11, color: inactiveTxt }}>Settings</div>
                </div>
              </Link>
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  borderRadius: 9, padding: "8px 12px",
                  fontSize: 13, color: inactiveTxt, background: "none",
                  border: "none", cursor: "pointer", textAlign: "left",
                  transition: "color 0.1s",
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
                Sign out
              </button>
            </>
          ) : (
            <Link
              href="/login"
              style={{
                display: "flex", alignItems: "center", gap: 10,
                borderRadius: 9, padding: "9px 12px",
                fontSize: 14, fontWeight: 500, color: inactiveTxt,
                textDecoration: "none",
                transition: "color 0.1s",
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/>
              </svg>
              Sign in
            </Link>
          )}
        </div>
      </aside>

      {/* Mobile bottom bar — high z-index + compositor layer so page content / zoom don’t paint over it; px-based type/icons for stable sizing */}
      <nav
        className="md-hide nav-mobile-dock"
        style={{
          position: "fixed",
          zIndex: 4000,
          left: 0,
          right: 0,
          bottom: 0,
          width: "100%",
          maxWidth: "100%",
          boxSizing: "border-box",
          borderTop: `1px solid ${border}`,
          backgroundColor: bg,
          display: "flex",
          alignItems: "stretch",
          justifyContent: "space-around",
          paddingTop: 8,
          paddingBottom: "max(10px, env(safe-area-inset-bottom, 0px))",
          minHeight: 56,
          transform: "translateZ(0)",
          WebkitTransform: "translateZ(0)",
          isolation: "isolate",
        }}
      >
        <style>{`
          @media (min-width: 768px) { .md-hide { display: none !important; } }
          .nav-mobile-dock a { -webkit-tap-highlight-color: transparent; touch-action: manipulation; }
        `}</style>

        {links.map((l) => {
          const resolvedHref = resolveNavHref(l, !!session?.user);
          const isActive = navItemActive(l, pathname, feedDiscover, !!session?.user);
          const isMessages = l.href === "/messages";
          const msgBadge = isMessages && session?.user && unreadTotal > 0;
          if (l.href === "/books") {
            return (
              <Suspense
                key={l.href}
                fallback={
                  <Link
                    href="/books"
                    style={{
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 4,
                      padding: "6px 2px",
                      minWidth: 0,
                      fontSize: "11px",
                      lineHeight: "13px",
                      fontWeight: 500,
                      color: isActive ? activeTxt : inactiveTxt,
                      textDecoration: "none",
                    }}
                  >
                    <span style={{ width: 22, height: 22, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }} aria-hidden>
                      {l.icon}
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: 4, maxWidth: "100%", padding: "0 2px" }}>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.label}</span>
                    </span>
                  </Link>
                }
              >
                <div style={{ flex: 1, display: "flex", minWidth: 0 }}>
                  <NavBooksLink
                    variant="mobile"
                    isActive={isActive}
                    activeTxt={activeTxt}
                    inactiveTxt={inactiveTxt}
                    activeBg="transparent"
                    icon={l.icon}
                    label={l.label}
                  />
                </div>
              </Suspense>
            );
          }
          return (
            <Link
              key={l.href}
              href={resolvedHref}
              onClick={(e) => {
                if (!isMessages || !session?.user) return;
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                e.preventDefault();
                messagesDock.goInbox();
                messagesDock.open();
              }}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
                padding: "6px 2px",
                minWidth: 0,
                fontSize: "11px",
                lineHeight: "13px",
                fontWeight: 500,
                color: isActive ? activeTxt : inactiveTxt,
                textDecoration: "none",
              }}
            >
              <span
                style={{
                  width: 22,
                  height: 22,
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                aria-hidden
              >
                {l.icon}
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 4, maxWidth: "100%", padding: "0 2px" }}>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.label}</span>
                {msgBadge ? <UnreadCountBadge count={unreadTotal} size="sm" /> : null}
              </span>
            </Link>
          );
        })}

        {/* Profile tab */}
        <Link
          href={session?.user ? "/settings" : "/login"}
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 4,
            padding: "6px 2px",
            minWidth: 0,
            fontSize: "11px",
            lineHeight: "13px",
            fontWeight: 500,
            color: pathname.startsWith("/settings") ? activeTxt : inactiveTxt,
            textDecoration: "none",
          }}
        >
          <span
            style={{
              width: 22,
              height: 22,
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            aria-hidden
          >
            {session?.user ? (
              <Avatar name={userName} size={22} />
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
              </svg>
            )}
          </span>
          {session?.user ? "Profile" : "Sign in"}
        </Link>
      </nav>
    </>
  );
}

export default function Nav() {
  return (
    <Suspense fallback={null}>
      <NavContent />
    </Suspense>
  );
}
