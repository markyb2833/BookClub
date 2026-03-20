"use client";

import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { useSession } from "next-auth/react";

interface ThemeSettings {
  theme: "light" | "dark";
  accentColour: string;
  textColour: string;
}

const defaults: ThemeSettings = {
  theme: "light",
  accentColour: "#8b5cf6",
  textColour: "#1c1917",
};

const ThemeContext = createContext<{
  settings: ThemeSettings;
  update: (s: Partial<ThemeSettings>) => void;
  save: () => Promise<void>;
}>({
  settings: defaults,
  update: () => {},
  save: async () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

function applyTheme(s: ThemeSettings) {
  const root = document.documentElement;

  // Dark / light class on <html>
  if (s.theme === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }

  // CSS variables consumed site-wide
  root.style.setProperty("--accent", s.accentColour);
  root.style.setProperty("--text", s.textColour);

  // Background surfaces shift for dark mode
  if (s.theme === "dark") {
    root.style.setProperty("--bg", "#171717");
    root.style.setProperty("--surface", "#262626");
    root.style.setProperty("--border", "#404040");
    root.style.setProperty("--muted", "#a3a3a3");
  } else {
    root.style.setProperty("--bg", "#fafaf9");
    root.style.setProperty("--surface", "#ffffff");
    root.style.setProperty("--border", "#e7e5e4");
    root.style.setProperty("--muted", "#a8a29e");
  }
}

const STORAGE_KEY = "bc_theme";

function loadCached(): ThemeSettings | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ThemeSettings) : null;
  } catch {
    return null;
  }
}

function saveCache(s: ThemeSettings) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch {}
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const [settings, setSettings] = useState<ThemeSettings>(defaults);

  // Apply cached theme immediately on first client render (no SSR mismatch)
  useEffect(() => {
    const cached = loadCached();
    if (cached) {
      setSettings(cached);
      applyTheme(cached);
    }
  }, []);

  // Load saved settings from server when session is available
  const userId = session?.user?.id;
  useEffect(() => {
    if (!userId) return;
    fetch("/api/settings/appearance")
      .then((r) => r.json())
      .then((data: ThemeSettings) => {
        setSettings(data);
        applyTheme(data);
        saveCache(data);
      })
      .catch(() => {});
  }, [userId]);

  // Apply on every change (e.g. live preview on settings page)
  useEffect(() => {
    applyTheme(settings);
  }, [settings]);

  // Keep a ref so save() always reads the latest settings without stale closures
  const settingsRef = useRef(settings);
  useEffect(() => { settingsRef.current = settings; }, [settings]);

  const update = useCallback((partial: Partial<ThemeSettings>) => {
    setSettings((prev) => ({ ...prev, ...partial }));
  }, []);

  const save = useCallback(async () => {
    const current = settingsRef.current;
    await fetch("/api/settings/appearance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(current),
    });
    saveCache(current);
  }, []);

  return (
    <ThemeContext.Provider value={{ settings, update, save }}>
      {children}
    </ThemeContext.Provider>
  );
}
