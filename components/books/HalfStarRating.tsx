"use client";

import { useCallback } from "react";

const STAR = "★";

/** Read-only row: 0.5–5 in half steps. */
export function HalfStarRatingDisplay({
  rating,
  fontSize = 14,
  gap = 2,
  filledColor = "#f59e0b",
  emptyColor = "var(--border)",
}: {
  rating: number;
  fontSize?: number;
  gap?: number;
  filledColor?: string;
  emptyColor?: string;
}) {
  const r = Number(rating);
  if (!Number.isFinite(r)) return null;

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap, lineHeight: 1 }} aria-label={`${r} out of 5 stars`}>
      {[0, 1, 2, 3, 4].map((i) => {
        const full = r >= i + 1;
        const half = !full && r >= i + 0.5;
        return (
          <span
            key={i}
            style={{
              position: "relative",
              display: "inline-block",
              width: fontSize * 1.05,
              height: fontSize,
              fontSize,
            }}
          >
            <span style={{ position: "absolute", left: 0, top: 0, color: emptyColor, pointerEvents: "none" }}>{STAR}</span>
            {full ? (
              <span style={{ position: "absolute", left: 0, top: 0, color: filledColor, pointerEvents: "none" }}>{STAR}</span>
            ) : half ? (
              <span
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  width: "50%",
                  overflow: "hidden",
                  color: filledColor,
                  pointerEvents: "none",
                }}
              >
                {STAR}
              </span>
            ) : null}
          </span>
        );
      })}
    </span>
  );
}

/**
 * Pick 0.5–5 in half-star steps. Click same value again to clear (optional).
 * `allowClear`: when false, clicking the current value keeps it (still toggles between half/full on same star).
 */
export function HalfStarRatingInput({
  value,
  onChange,
  accent,
  fontSize = 22,
  allowClear = true,
}: {
  value: number | null;
  onChange: (next: number | null) => void;
  accent: string;
  fontSize?: number;
  allowClear?: boolean;
}) {
  const pick = useCallback(
    (next: number) => {
      if (allowClear && value === next) onChange(null);
      else onChange(next);
    },
    [allowClear, onChange, value],
  );

  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 3 }} role="group" aria-label="Rating">
        {[0, 1, 2, 3, 4].map((i) => (
          <span
            key={i}
            style={{
              position: "relative",
              display: "inline-block",
              width: fontSize * 1.05,
              height: fontSize,
              fontSize,
            }}
          >
            <span style={{ position: "absolute", left: 0, top: 0, color: "var(--border)", pointerEvents: "none" }}>{STAR}</span>
            {value != null && value >= i + 1 ? (
              <span style={{ position: "absolute", left: 0, top: 0, color: "#f59e0b", pointerEvents: "none" }}>{STAR}</span>
            ) : value != null && value >= i + 0.5 ? (
              <span
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  width: "50%",
                  overflow: "hidden",
                  color: "#f59e0b",
                  pointerEvents: "none",
                }}
              >
                {STAR}
              </span>
            ) : null}
            <button
              type="button"
              aria-label={`${i + 0.5} stars out of 5`}
              onClick={() => pick(i + 0.5)}
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                width: "50%",
                height: "100%",
                padding: 0,
                border: "none",
                background: "transparent",
                cursor: "pointer",
                borderRadius: "4px 0 0 4px",
              }}
            />
            <button
              type="button"
              aria-label={`${i + 1} stars out of 5`}
              onClick={() => pick(i + 1)}
              style={{
                position: "absolute",
                right: 0,
                top: 0,
                width: "50%",
                height: "100%",
                padding: 0,
                border: "none",
                background: "transparent",
                cursor: "pointer",
                borderRadius: "0 4px 4px 0",
              }}
            />
          </span>
        ))}
      </div>
      {value != null && (
        <span style={{ fontSize: 13, fontWeight: 600, color: accent }}>{value.toFixed(1)} / 5</span>
      )}
      <span style={{ fontSize: 12, color: "var(--muted)" }}>Optional · half stars</span>
    </div>
  );
}
