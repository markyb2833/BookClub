import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function HomePage() {
  const session = await auth();
  if (session?.user?.id) redirect("/shelves");

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 24px", textAlign: "center" }}>
      <div style={{ maxWidth: 520 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📚</div>
        <h1 style={{ fontSize: 40, fontWeight: 900, color: "var(--text)", letterSpacing: "-1px", lineHeight: 1.1, marginBottom: 16 }}>
          Your reading life,<br />beautifully organised.
        </h1>
        <p style={{ fontSize: 17, color: "var(--muted)", lineHeight: 1.7, marginBottom: 36 }}>
          Track books, build shelves, write reviews, and share your reading journey with a community that loves books as much as you do.
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <Link href="/register" style={{ padding: "13px 32px", borderRadius: 12, background: "var(--accent)", color: "#fff", fontWeight: 700, fontSize: 15, textDecoration: "none", transition: "opacity 0.15s" }}>
            Get started — it&apos;s free
          </Link>
          <Link href="/books" style={{ padding: "13px 28px", borderRadius: 12, border: "1.5px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontWeight: 600, fontSize: 15, textDecoration: "none" }}>
            Browse books
          </Link>
        </div>
        <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 20 }}>
          Already have an account?{" "}
          <Link href="/login" style={{ color: "var(--accent)", fontWeight: 600, textDecoration: "none" }}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}
