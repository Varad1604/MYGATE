"use client";

import { useState } from "react";
import { api, persistTokens } from "@/lib/api";
import { setSession } from "@/lib/session";

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: { id: string; fullName: string };
  context: { communityId: string; communityName?: string; isPlatformSuperAdmin?: boolean };
}

export default function LoginPage() {
  const [identifier, setId] = useState("admin@greenview.test");
  const [password, setPw] = useState("Demo#Pass1");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const res = await api().post<LoginResponse>("/auth/login", { identifier, password });
      persistTokens(res.accessToken, res.refreshToken);
      setSession({
        userId: res.user.id,
        name: res.user.fullName,
        communityId: res.context.communityId,
        communityName: res.context.communityName ?? "Community",
        isPlatformSuperAdmin: res.context.isPlatformSuperAdmin ?? false,
      });
      window.location.href = "/dashboard";
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <div className="card">
        <div className="brand" style={{ marginBottom: 8 }}>SocietyOS Admin</div>
        <form onSubmit={submit}>
          <div style={{ marginBottom: 10 }}>
            <input
              placeholder="Email or phone"
              value={identifier}
              onChange={(e) => setId(e.target.value)}
              autoComplete="username"
            />
          </div>
          <div style={{ marginBottom: 12 }}>
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPw(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          <button type="submit" disabled={busy} style={{ width: "100%" }}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
          {err && <div className="error">{err}</div>}
        </form>
      </div>
    </div>
  );
}
