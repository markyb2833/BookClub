"use client";

import Nav from "@/components/Nav";
import { useTheme } from "@/components/ThemeProvider";
import { MessagesDockProvider } from "@/components/social/MessagesDock";
import { UnreadMessagesProvider } from "@/components/social/UnreadMessagesContext";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const { settings } = useTheme();
  const isDark = settings.theme === "dark";

  return (
    <UnreadMessagesProvider>
    <MessagesDockProvider>
    <div style={{ display: "flex", minHeight: "100vh", background: isDark ? "#171717" : "#fafaf9" }}>
      <Nav />
      <main style={{
        flex: 1,
        marginLeft: 0,
        paddingBottom: 80,
        minHeight: "100vh",
        background: isDark ? "#171717" : "#fafaf9",
      }}
        className="md-main"
      >
        <style>{`
          @media (max-width: 767px) {
            .md-main { min-width: 0; overflow-x: clip; max-width: 100%; }
          }
          @media (min-width: 768px) {
            .md-main { margin-left: 220px !important; padding-bottom: 0 !important; }
          }
        `}</style>
        {children}
      </main>
    </div>
    </MessagesDockProvider>
    </UnreadMessagesProvider>
  );
}
