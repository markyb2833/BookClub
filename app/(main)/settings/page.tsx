"use client";

import { useState } from "react";
import { useTheme } from "@/components/ThemeProvider";

const ACCENT_PRESETS = [
  { label: "Violet",  value: "#8b5cf6" },
  { label: "Sky",     value: "#0ea5e9" },
  { label: "Rose",    value: "#f43f5e" },
  { label: "Amber",   value: "#f59e0b" },
  { label: "Emerald", value: "#10b981" },
  { label: "Slate",   value: "#64748b" },
  { label: "Orange",  value: "#f97316" },
  { label: "Pink",    value: "#ec4899" },
];

const TEXT_PRESETS_DARK = [
  { label: "White",      value: "#ffffff" },
  { label: "Off-white",  value: "#f5f5f4" },
  { label: "Silver",     value: "#d4d4d4" },
  { label: "Muted",      value: "#a3a3a3" },
];

const TEXT_PRESETS_LIGHT = [
  { label: "Near-black", value: "#1c1917" },
  { label: "Graphite",   value: "#374151" },
  { label: "Slate",      value: "#475569" },
  { label: "Stone",      value: "#57534e" },
];

export default function SettingsPage() {
  const { settings, update, save } = useTheme();
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    await save();
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const isDark = settings.theme === "dark";
  const surf = isDark ? "#262626" : "#fff";
  const bord = isDark ? "#404040" : "#e7e5e4";
  const txt  = isDark ? "#e5e5e5" : "#1c1917";
  const sub  = isDark ? "#a3a3a3" : "#78716c";
  const bg   = isDark ? "#171717" : "#fafaf9";

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: "40px 24px 80px" }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: txt, marginBottom: 4 }}>Settings</h1>
        <p style={{ fontSize: 14, color: sub }}>Personalise your BookClub experience</p>
      </div>

      {/* Appearance section */}
      <Section title="Appearance" surf={surf} bord={bord} txt={txt}>

        {/* Theme toggle */}
        <div style={{ marginBottom: 28 }}>
          <Label txt={txt}>Mode</Label>
          <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
            {(["light", "dark"] as const).map((t) => (
              <ThemeCard
                key={t}
                mode={t}
                active={settings.theme === t}
                accent={settings.accentColour}
                onSelect={() => {
                  // auto-switch text colour to a sensible default for the new mode
                  const defaultText = t === "dark" ? "#f5f5f4" : "#1c1917";
                  update({ theme: t, textColour: defaultText });
                }}
              />
            ))}
          </div>
        </div>

        {/* Accent colour */}
        <div style={{ marginBottom: 28 }}>
          <Label txt={txt}>Accent colour</Label>
          <p style={{ fontSize: 12, color: sub, marginBottom: 10, marginTop: 2 }}>
            Used for buttons, links, and highlights
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
            {ACCENT_PRESETS.map((p) => (
              <ColourSwatch
                key={p.value}
                colour={p.value}
                label={p.label}
                active={settings.accentColour === p.value}
                onSelect={() => update({ accentColour: p.value })}
              />
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <input
              type="color"
              value={settings.accentColour}
              onChange={(e) => update({ accentColour: e.target.value })}
              style={{ width: 36, height: 36, borderRadius: 8, border: `1.5px solid ${bord}`, cursor: "pointer", padding: 2, background: surf }}
            />
            <span style={{ fontSize: 13, color: sub, fontFamily: "monospace" }}>{settings.accentColour}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto" }}>
              <span style={{ fontSize: 13, color: sub }}>Preview:</span>
              <button style={{ background: settings.accentColour, color: "#fff", border: "none", borderRadius: 8, padding: "7px 16px", fontSize: 13, fontWeight: 600, cursor: "default" }}>
                Button
              </button>
            </div>
          </div>
        </div>

        {/* Text colour */}
        <div>
          <Label txt={txt}>Text colour</Label>
          <p style={{ fontSize: 12, color: sub, marginBottom: 10, marginTop: 2 }}>
            Primary body text colour
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
            {(isDark ? TEXT_PRESETS_DARK : TEXT_PRESETS_LIGHT).map((p) => (
              <button
                key={p.value}
                onClick={() => update({ textColour: p.value })}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  border: `1.5px solid ${settings.textColour === p.value ? p.value : bord}`,
                  borderRadius: 8,
                  padding: "6px 12px",
                  background: settings.textColour === p.value ? `${p.value}15` : surf,
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                <span style={{ width: 14, height: 14, borderRadius: "50%", background: p.value, flexShrink: 0, border: `1px solid ${bord}` }} />
                <span style={{ fontSize: 13, color: txt }}>{p.label}</span>
              </button>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <input
              type="color"
              value={settings.textColour}
              onChange={(e) => update({ textColour: e.target.value })}
              style={{ width: 36, height: 36, borderRadius: 8, border: `1.5px solid ${bord}`, cursor: "pointer", padding: 2, background: surf }}
            />
            <span style={{ fontSize: 13, color: sub, fontFamily: "monospace" }}>{settings.textColour}</span>
            <div style={{ marginLeft: "auto" }}>
              <span style={{ fontSize: 15, color: settings.textColour, fontWeight: 500 }}>The quick brown fox</span>
            </div>
          </div>
        </div>
      </Section>

      {/* Live preview */}
      <div style={{ marginTop: 24, borderRadius: 14, border: `1.5px solid ${bord}`, overflow: "hidden" }}>
        <div style={{ padding: "10px 16px", background: isDark ? "#1a1a1a" : "#f5f5f4", borderBottom: `1px solid ${bord}` }}>
          <span style={{ fontSize: 12, color: sub, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" }}>Preview</span>
        </div>
        <div style={{ background: bg, padding: 20 }}>
          <div style={{ background: surf, borderRadius: 12, border: `1px solid ${bord}`, padding: 16, display: "flex", gap: 14 }}>
            <div style={{ width: 56, height: 84, borderRadius: 6, background: bord, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, color: settings.textColour, marginBottom: 4 }}>The Name of the Wind</div>
              <div style={{ fontSize: 13, color: sub, marginBottom: 8 }}>Patrick Rothfuss · 2007</div>
              <div style={{ display: "flex", gap: 6 }}>
                <span style={{ fontSize: 11, background: `${settings.accentColour}20`, color: settings.accentColour, borderRadius: 999, padding: "2px 10px", fontWeight: 500 }}>Fantasy</span>
                <span style={{ fontSize: 11, background: `${settings.accentColour}20`, color: settings.accentColour, borderRadius: 999, padding: "2px 10px", fontWeight: 500 }}>Adventure</span>
              </div>
              <button style={{ marginTop: 10, background: settings.accentColour, color: "#fff", border: "none", borderRadius: 7, padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "default" }}>
                + Add to shelf
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Save button */}
      <div style={{ marginTop: 24, display: "flex", justifyContent: "flex-end" }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            background: saved ? "#16a34a" : settings.accentColour,
            color: "#fff",
            border: "none",
            borderRadius: 10,
            padding: "12px 28px",
            fontSize: 15,
            fontWeight: 600,
            cursor: saving ? "not-allowed" : "pointer",
            opacity: saving ? 0.7 : 1,
            transition: "background 0.2s",
            minWidth: 140,
          }}
        >
          {saved ? "Saved!" : saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}

function Section({ title, children, surf, bord, txt }: {
  title: string;
  children: React.ReactNode;
  surf: string; bord: string; txt: string;
}) {
  return (
    <div style={{ marginBottom: 20 }}>
      <h2 style={{ fontSize: 13, fontWeight: 600, color: txt, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 12 }}>{title}</h2>
      <div style={{ background: surf, borderRadius: 14, border: `1.5px solid ${bord}`, padding: 24 }}>
        {children}
      </div>
    </div>
  );
}

function Label({ children, txt }: { children: React.ReactNode; txt: string }) {
  return <div style={{ fontSize: 14, fontWeight: 600, color: txt }}>{children}</div>;
}

function ColourSwatch({ colour, label, active, onSelect }: {
  colour: string; label: string; active: boolean; onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      title={label}
      style={{
        width: 32,
        height: 32,
        borderRadius: "50%",
        background: colour,
        border: active ? `3px solid ${colour}` : "3px solid transparent",
        outline: active ? `2px solid #fff` : "none",
        boxShadow: active ? `0 0 0 3px ${colour}` : "none",
        cursor: "pointer",
        transition: "all 0.15s",
      }}
    />
  );
}

function ThemeCard({ mode, active, accent, onSelect }: { mode: "light" | "dark"; active: boolean; accent: string; onSelect: () => void }) {
  const isLight = mode === "light";
  // Card chrome always shows its own mode colours regardless of current theme
  const cardBg   = isLight ? "#fff"     : "#1a1a1a";
  const cardBord = isLight ? "#e7e5e4"  : "#333";
  const mockBg   = isLight ? "#fafaf9"  : "#171717";
  const mockBord = isLight ? "#e7e5e4"  : "#404040";
  const line1    = isLight ? "#d6d3d1"  : "#525252";
  const line2    = isLight ? "#e7e5e4"  : "#404040";
  const labelCol = isLight ? "#1c1917"  : "#f5f5f4";

  return (
    <button
      onClick={onSelect}
      style={{
        flex: 1,
        borderRadius: 12,
        border: `2px solid ${active ? accent : cardBord}`,
        background: cardBg,
        padding: 14,
        cursor: "pointer",
        textAlign: "left",
        transition: "all 0.15s",
        boxShadow: active ? `0 0 0 3px ${accent}30` : "none",
      }}
    >
      {/* Mini UI mockup */}
      <div style={{ borderRadius: 8, background: mockBg, border: `1px solid ${mockBord}`, padding: 8, marginBottom: 10, height: 64, overflow: "hidden" }}>
        <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
          <div style={{ width: 24, height: 5, borderRadius: 3, background: line1 }} />
          <div style={{ width: 36, height: 5, borderRadius: 3, background: line2 }} />
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          <div style={{ width: 20, height: 30, borderRadius: 3, background: line2 }} />
          <div style={{ flex: 1 }}>
            <div style={{ height: 4, borderRadius: 2, background: line1, marginBottom: 3, width: "70%" }} />
            <div style={{ height: 4, borderRadius: 2, background: line2, width: "50%" }} />
          </div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: labelCol, textTransform: "capitalize" }}>{mode}</span>
        {active && (
          <span style={{ fontSize: 11, background: accent, color: "#fff", borderRadius: 999, padding: "2px 8px", fontWeight: 600 }}>Active</span>
        )}
      </div>
    </button>
  );
}
