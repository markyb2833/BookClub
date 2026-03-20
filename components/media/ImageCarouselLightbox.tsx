"use client";

import Image from "next/image";
import { useCallback, useEffect } from "react";

export type CarouselImage = { url: string; caption?: string | null };

export default function ImageCarouselLightbox({
  open,
  images,
  index,
  onClose,
  onIndexChange,
}: {
  open: boolean;
  images: CarouselImage[];
  index: number;
  onClose: () => void;
  onIndexChange: (i: number) => void;
}) {
  const safeLen = images.length;
  const i = safeLen === 0 ? 0 : Math.min(Math.max(0, index), safeLen - 1);
  const cur = images[i];

  const go = useCallback(
    (delta: number) => {
      if (safeLen === 0) return;
      onIndexChange((i + delta + safeLen) % safeLen);
    },
    [i, onIndexChange, safeLen],
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, go]);

  if (!open || !cur) return null;

  return (
    <div
      role="dialog"
      aria-modal
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2000,
        background: "rgba(0,0,0,0.88)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        style={{
          position: "absolute",
          top: 16,
          right: 16,
          border: "none",
          background: "rgba(255,255,255,0.12)",
          color: "#fff",
          fontSize: 22,
          width: 44,
          height: 44,
          borderRadius: 999,
          cursor: "pointer",
          lineHeight: 1,
        }}
      >
        ×
      </button>
      {safeLen > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              go(-1);
            }}
            style={{
              position: "absolute",
              left: 12,
              top: "50%",
              transform: "translateY(-50%)",
              border: "none",
              background: "rgba(255,255,255,0.15)",
              color: "#fff",
              fontSize: 28,
              width: 48,
              height: 48,
              borderRadius: 999,
              cursor: "pointer",
            }}
          >
            ‹
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              go(1);
            }}
            style={{
              position: "absolute",
              right: 12,
              top: "50%",
              transform: "translateY(-50%)",
              border: "none",
              background: "rgba(255,255,255,0.15)",
              color: "#fff",
              fontSize: 28,
              width: 48,
              height: 48,
              borderRadius: 999,
              cursor: "pointer",
            }}
          >
            ›
          </button>
        </>
      )}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative",
          width: "min(92vw, 900px)",
          maxHeight: "78vh",
          aspectRatio: "4/3",
          borderRadius: 12,
          overflow: "hidden",
          background: "#111",
        }}
      >
        <Image src={cur.url} alt="" fill sizes="900px" style={{ objectFit: "contain" }} priority />
      </div>
      {cur.caption ? (
        <p
          onClick={(e) => e.stopPropagation()}
          style={{ color: "#e7e5e4", marginTop: 14, textAlign: "center", maxWidth: 640, fontSize: 15, lineHeight: 1.5 }}
        >
          {cur.caption}
        </p>
      ) : null}
      {safeLen > 1 && (
        <p style={{ color: "#a8a29e", fontSize: 13, marginTop: 10 }}>
          {i + 1} / {safeLen}
        </p>
      )}
    </div>
  );
}
