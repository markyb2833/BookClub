"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ username: "", email: "", password: "", confirm: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (form.password !== form.confirm) { setError("Passwords don't match"); return; }
    setLoading(true);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: form.username, email: form.email, password: form.password }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error ?? "Something went wrong"); return; }
    router.push("/login?registered=1");
  }

  return (
    <div style={{ width: "100%", maxWidth: 400 }}>
      {/* Logo */}
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <div style={{ fontSize: 28, fontWeight: 800, color: "#1c1917", letterSpacing: "-0.5px" }}>BookClub</div>
        <div style={{ fontSize: 14, color: "#a8a29e", marginTop: 4 }}>Create your account</div>
      </div>

      <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e7e5e4", padding: 32, boxShadow: "0 1px 8px rgba(0,0,0,0.06)" }}>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Field
            label="Username"
            type="text"
            value={form.username}
            onChange={(v) => setForm((f) => ({ ...f, username: v }))}
            placeholder="bookworm42"
            hint="Letters, numbers and underscores only"
            autoComplete="username"
          />
          <Field
            label="Email"
            type="email"
            value={form.email}
            onChange={(v) => setForm((f) => ({ ...f, email: v }))}
            placeholder="you@example.com"
            autoComplete="email"
          />
          <Field
            label="Password"
            type="password"
            value={form.password}
            onChange={(v) => setForm((f) => ({ ...f, password: v }))}
            placeholder="At least 8 characters"
            autoComplete="new-password"
          />
          <Field
            label="Confirm password"
            type="password"
            value={form.confirm}
            onChange={(v) => setForm((f) => ({ ...f, confirm: v }))}
            placeholder="Repeat your password"
            autoComplete="new-password"
          />

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
              transition: "opacity 0.15s",
            }}
          >
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>
      </div>

      <p style={{ textAlign: "center", marginTop: 20, fontSize: 14, color: "#78716c" }}>
        Already have an account?{" "}
        <Link href="/login" style={{ color: "#1c1917", fontWeight: 600, textDecoration: "none" }}>
          Sign in
        </Link>
      </p>
    </div>
  );
}

function Field({
  label, type, value, onChange, placeholder, hint, autoComplete,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
  autoComplete?: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <label style={{ fontSize: 13, fontWeight: 500, color: "#44403c" }}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required
        style={{
          borderRadius: 8,
          border: "1.5px solid #e7e5e4",
          background: "#fafaf9",
          padding: "10px 12px",
          fontSize: 14,
          color: "#1c1917",
          outline: "none",
          transition: "border-color 0.15s",
        }}
        onFocus={(e) => { e.target.style.borderColor = "#a8a29e"; e.target.style.background = "#fff"; }}
        onBlur={(e) => { e.target.style.borderColor = "#e7e5e4"; e.target.style.background = "#fafaf9"; }}
      />
      {hint && <span style={{ fontSize: 12, color: "#a8a29e" }}>{hint}</span>}
    </div>
  );
}
