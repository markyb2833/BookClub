"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useBooksNavHref } from "./NavBooksHref";

type Props = {
  variant: "sidebar" | "mobile";
  isActive: boolean;
  activeTxt: string;
  inactiveTxt: string;
  activeBg: string;
  icon: ReactNode;
  label: string;
};

export default function NavBooksLink({ variant, isActive, activeTxt, inactiveTxt, activeBg, icon, label }: Props) {
  const booksHref = useBooksNavHref();

  if (variant === "sidebar") {
    return (
      <Link
        href={booksHref}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          borderRadius: 9,
          padding: "9px 12px",
          fontSize: 14,
          fontWeight: 500,
          textDecoration: "none",
          color: isActive ? activeTxt : inactiveTxt,
          background: isActive ? activeBg : "transparent",
          transition: "background 0.1s, color 0.1s",
        }}
      >
        {icon}
        <span style={{ flex: 1, minWidth: 0 }}>{label}</span>
      </Link>
    );
  }

  return (
    <Link
      href={booksHref}
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
        {icon}
      </span>
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", padding: "0 2px" }}>{label}</span>
    </Link>
  );
}
