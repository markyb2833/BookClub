"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const registered = searchParams.get("registered");

  const [form, setForm] = useState({ login: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const result = await signIn("credentials", {
      login: form.login.trim(),
      password: form.password,
      redirect: false,
    });
    setLoading(false);
    if (result?.error) { setError("Invalid username/email or password"); return; }
    router.push("/");
    router.refresh();
  }

  return (
    <div style={{ width: "100%", maxWidth: 400 }}>
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <div style={{ fontSize: 28, fontWeight: 800, color: "#1c1917", letterSpacing: "-0.5px" }}>BookClub</div>
        <div style={{ fontSize: 14, color: "#a8a29e", marginTop: 4 }}>Welcome back</div>
      </div>

      <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e7e5e4", padding: 32, boxShadow: "0 1px 8px rgba(0,0,0,0.06)" }}>
        {registered && (
          <div style={{ fontSize: 13, color: "#16a34a", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "10px 14px", marginBottom: 16 }}>
            Account created! Sign in below.
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <label style={{ fontSize: 13, fontWeight: 500, color: "#44403c" }}>Username or email</label>
            <input
              type="text"
              value={form.login}
              onChange={(e) => setForm((f) => ({ ...f, login: e.target.value }))}
              placeholder="bookworm42 or you@example.com"
              autoComplete="username"
              required
              style={{ borderRadius: 8, border: "1.5px solid #e7e5e4", background: "#fafaf9", padding: "10px 12px", fontSize: 14, color: "#1c1917", outline: "none" }}
              onFocus={(e) => { e.target.style.borderColor = "#a8a29e"; e.target.style.background = "#fff"; }}
              onBlur={(e) => { e.target.style.borderColor = "#e7e5e4"; e.target.style.background = "#fafaf9"; }}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <label style={{ fontSize: 13, fontWeight: 500, color: "#44403c" }}>Password</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              placeholder="Your password"
              autoComplete="current-password"
              required
              style={{ borderRadius: 8, border: "1.5px solid #e7e5e4", background: "#fafaf9", padding: "10px 12px", fontSize: 14, color: "#1c1917", outline: "none" }}
              onFocus={(e) => { e.target.style.borderColor = "#a8a29e"; e.target.style.background = "#fff"; }}
              onBlur={(e) => { e.target.style.borderColor = "#e7e5e4"; e.target.style.background = "#fafaf9"; }}
            />
          </div>

          {error && (
            <div style={{ fontSize: 13, color: "#dc2626", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 14px" }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 4,
              background: "#1c1917",
              color: "#fff",
              border: "none",
              borderRadius: 10,
              padding: "13px 0",
              fontSize: 15,
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>

      <p style={{ textAlign: "center", marginTop: 20, fontSize: 14, color: "#78716c" }}>
        Don&apos;t have an account?{" "}
        <Link href="/register" style={{ color: "#1c1917", fontWeight: 600, textDecoration: "none" }}>
          Create one
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
