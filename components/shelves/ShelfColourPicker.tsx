"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const POPOVER_W = 200;
const POPOVER_MAX_H = 340;

export default function ShelfColourPicker({ label, value, presets, onChange, onClear, onSave }: {
  label: string;
  value: string | null;
  presets: string[];
  onChange: (v: string) => void;
  onClear: () => void;
  onSave: (v: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  function close() {
    setOpen(false);
  }

  const updatePosition = useCallback(() => {
    const btn = buttonRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    let top = r.bottom + 6;
    let left = r.right - POPOVER_W;
    if (left < 8) left = 8;
    if (left + POPOVER_W > window.innerWidth - 8) {
      left = window.innerWidth - POPOVER_W - 8;
    }
    if (top + POPOVER_MAX_H > window.innerHeight - 8) {
      top = r.top - POPOVER_MAX_H - 6;
    }
    if (top < 8) top = 8;
    setCoords({ top, left });
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      const t = e.target as Node;
      if (buttonRef.current?.contains(t)) return;
      if (popoverRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open]);

  const popover = open && (
    <div
      ref={popoverRef}
      role="dialog"
      aria-label={`${label} colour`}
      style={{
        position: "fixed",
        top: coords.top,
        left: coords.left,
        width: POPOVER_W,
        zIndex: 8500,
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: 12,
        boxShadow: "0 12px 40px rgba(0,0,0,0.28)",
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: "var(--muted)",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 8 }}>
        {presets.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => {
              onChange(c);
              onSave(c);
              close();
            }}
            style={{
              width: 22,
              height: 22,
              borderRadius: "50%",
              background: c,
              border: value === c ? "3px solid var(--text)" : "2px solid transparent",
              cursor: "pointer",
              transition: "transform 0.1s",
            }}
          />
        ))}
      </div>
      <input
        type="color"
        value={value ?? "#8b5cf6"}
        onChange={(e) => onChange(e.target.value)}
        onBlur={(e) => onSave(e.target.value)}
        style={{
          width: "100%",
          height: 28,
          borderRadius: 6,
          border: "1px solid var(--border)",
          cursor: "pointer",
          padding: 2,
          background: "var(--bg)",
        }}
      />
      <button
        type="button"
        onClick={() => {
          onClear();
          onSave(null);
          close();
        }}
        style={{
          marginTop: 8,
          width: "100%",
          fontSize: 11,
          color: "var(--muted)",
          background: "transparent",
          border: "1px solid var(--border)",
          borderRadius: 6,
          padding: "4px 0",
          cursor: "pointer",
        }}
      >
        Reset to default
      </button>
    </div>
  );

  return (
    <div style={{ position: "relative", display: "inline-flex" }}>
      <button
        ref={buttonRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        title={label}
        style={{
          width: 20,
          height: 20,
          borderRadius: "50%",
          background: value ?? "conic-gradient(red, yellow, lime, cyan, blue, magenta, red)",
          border: "2px solid var(--border)",
          cursor: "pointer",
          flexShrink: 0,
          boxShadow: open ? "0 0 0 2px var(--accent)" : "none",
        }}
      />
      {typeof document !== "undefined" && popover ? createPortal(popover, document.body) : null}
    </div>
  );
}
