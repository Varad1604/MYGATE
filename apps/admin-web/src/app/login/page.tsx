"use client";

import { useState } from "react";
import { api, persistTokens } from "@/lib/api";
import { setSession } from "@/lib/session";

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  // The API returns the principal INSIDE context (no separate user object).
  context: {
    userId: string;
    fullName?: string;
    communityId?: string;
    communityName?: string;
    isPlatformSuperAdmin?: boolean;
  };
}

export default function LoginPage() {
  const [identifier, setId] = useState("admin@greenview.test");
  const [password, setPw] = useState("Demo#Pass1");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!identifier.trim() || !password) { setErr("Enter your email and password."); return; }
    setErr(null);
    setBusy(true);
    try {
      const res = await api().post<LoginResponse>("/auth/login", { identifier: identifier.trim(), password });
      persistTokens(res.accessToken, res.refreshToken);
      setSession({
        userId: res.context.userId,
        name: res.context.fullName ?? identifier,
        communityId: res.context.communityId ?? "",
        communityName: res.context.communityName ?? "Community",
        isPlatformSuperAdmin: res.context.isPlatformSuperAdmin ?? false,
      });
      window.location.href = "/dashboard";
    } catch {
      setErr("Sign-in failed — check your email and password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <div className="card login-card">
        <div className="login-brand">
          <span className="brand-dot" aria-hidden />
          SocietyOS
        </div>
        <p className="login-sub">Society administration console.</p>
        <form onSubmit={submit}>
          <label className="field" style={{ marginBottom: "var(--s-3)" }}>
            Email or phone
            <input
              className="input"
              value={identifier}
              onChange={(e) => setId(e.target.value)}
              autoComplete="username"
            />
          </label>
          <label className="field" style={{ marginBottom: "var(--s-5)" }}>
            Password
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPw(e.target.value)}
              autoComplete="current-password"
            />
          </label>
          <button className="btn" type="submit" disabled={busy} style={{ width: "100%" }}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
          {err && (
            <div className="error-box" role="alert" style={{ marginTop: "var(--s-3)", justifyContent: "center" }}>
              {err}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
