"use client";

import Image from "next/image";
import { useState } from "react";
import ImageCarouselLightbox, { type CarouselImage } from "@/components/media/ImageCarouselLightbox";

export type AttachmentView = { id: string; url: string; caption?: string | null };

export default function AttachmentStrip({ attachments, size = 56 }: { attachments: AttachmentView[]; size?: number }) {
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);
  if (attachments.length === 0) return null;
  const carousel: CarouselImage[] = attachments.map((a) => ({ url: a.url, caption: a.caption ?? undefined }));
  return (
    <>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
        {attachments.map((a, i) => (
          <button
            key={a.id}
            type="button"
            onClick={() => {
              setIdx(i);
              setOpen(true);
            }}
            style={{
              position: "relative",
              width: size,
              height: size,
              borderRadius: 8,
              overflow: "hidden",
              border: "1px solid var(--border)",
              padding: 0,
              cursor: "pointer",
              background: "var(--border)",
            }}
          >
            <Image src={a.url} alt="" fill sizes={`${size}px`} style={{ objectFit: "cover" }} />
          </button>
        ))}
      </div>
      <ImageCarouselLightbox open={open} images={carousel} index={idx} onClose={() => setOpen(false)} onIndexChange={setIdx} />
    </>
  );
}
