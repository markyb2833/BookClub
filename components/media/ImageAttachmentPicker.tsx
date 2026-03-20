"use client";

import Image from "next/image";
import { useCallback, useRef, useState } from "react";

export type PickedImage = { url: string; caption: string };

export default function ImageAttachmentPicker({
  items,
  onChange,
  max = 12,
  label = "Images",
  showCaptions = true,
}: {
  items: PickedImage[];
  onChange: (next: PickedImage[]) => void;
  max?: number;
  label?: string;
  showCaptions?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const uploadFile = useCallback(
    async (file: File) => {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const d = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok) throw new Error(d.error ?? "Upload failed");
      if (!d.url) throw new Error("No URL returned");
      return d.url;
    },
    [],
  );

  const addFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = [...files].filter((f) => f.type.startsWith("image/"));
      if (list.length === 0) return;
      const room = max - items.length;
      if (room <= 0) return;
      setErr(null);
      setBusy(true);
      try {
        const next = [...items];
        for (const file of list.slice(0, room)) {
          const url = await uploadFile(file);
          next.push({ url, caption: "" });
        }
        onChange(next);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Upload failed");
      } finally {
        setBusy(false);
      }
    },
    [items, max, onChange, uploadFile],
  );

  return (
    <div style={{ marginTop: 4 }}>
      <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: "var(--text)" }}>{label}</p>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          void addFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        style={{
          borderRadius: 12,
          border: `2px dashed ${dragOver ? "var(--accent)" : "var(--border)"}`,
          background: dragOver ? "var(--surface)" : "var(--bg)",
          padding: "18px 14px",
          textAlign: "center",
          cursor: busy ? "wait" : "pointer",
          color: "var(--muted)",
          fontSize: 13,
          marginBottom: 10,
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files;
            e.target.value = "";
            if (f?.length) void addFiles(f);
          }}
        />
        {busy ? "Uploading…" : "Drop images here or click to browse"}
      </div>
      {err && <p style={{ color: "#b91c1c", fontSize: 12, marginBottom: 8 }}>{err}</p>}
      {items.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          {items.map((it, i) => (
            <div
              key={`${it.url}-${i}`}
              style={{
                width: showCaptions ? 140 : 88,
                borderRadius: 10,
                border: "1px solid var(--border)",
                overflow: "hidden",
                background: "var(--surface)",
              }}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(items.filter((_, j) => j !== i));
                }}
                style={{
                  position: "relative",
                  width: "100%",
                  aspectRatio: "1",
                  padding: 0,
                  border: "none",
                  cursor: "pointer",
                  display: "block",
                }}
              >
                <Image src={it.url} alt="" fill sizes="140px" style={{ objectFit: "cover" }} />
                <span
                  style={{
                    position: "absolute",
                    top: 4,
                    right: 4,
                    background: "rgba(0,0,0,0.55)",
                    color: "#fff",
                    fontSize: 11,
                    fontWeight: 700,
                    borderRadius: 6,
                    padding: "2px 8px",
                  }}
                >
                  ×
                </span>
              </button>
              {showCaptions && (
                <input
                  value={it.caption}
                  onChange={(e) => {
                    const v = e.target.value;
                    onChange(items.map((x, j) => (j === i ? { ...x, caption: v } : x)));
                  }}
                  placeholder="Caption"
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    border: "none",
                    borderTop: "1px solid var(--border)",
                    padding: "6px 8px",
                    fontSize: 11,
                    background: "var(--bg)",
                    color: "var(--text)",
                  }}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
