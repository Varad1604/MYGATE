import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";

interface VerifyResponse {
  accessToken: string;
  refreshToken: string;
  context: { roleKeys: string[]; communityId: string | null };
}

export default function Login() {
  const [target, setTarget] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"target" | "code">("target");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { refresh } = useAuth();
  const nav = useNavigate();

  async function requestCode() {
    setBusy(true); setErr(null);
    try {
      await api.post("/auth/request-otp", { target });
      setStage("code");
      if (import.meta.env.DEV) {
        try {
          const peek = await fetch(`/api/v1/__dev/last-otp?target=${encodeURIComponent(target)}`);
          if (peek.ok) {
            const { code } = (await peek.json()) as { code: string | null };
            if (code) setCode(code);
          }
        } catch { /* manual entry fine */ }
      }
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  async function verify() {
    setBusy(true); setErr(null);
    try {
      const res = await api.post<VerifyResponse>("/auth/verify-otp", { target, code });
      api.setTokens({ accessToken: res.accessToken, refreshToken: res.refreshToken });
      localStorage.setItem("sos.resident.tokens", JSON.stringify({ accessToken: res.accessToken, refreshToken: res.refreshToken }));
      if (res.context.roleKeys.includes("GUARD") || res.context.roleKeys.includes("SECURITY_MANAGER")) {
        setErr("Gate staff should use the Guard app.");
        return;
      }
      refresh();
      nav("/", { replace: true });
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <div>
      <h1>SocietyOS Resident</h1>
      <div className="card">
        {stage === "target" ? (
          <>
            <label>Phone or email</label>
            <input value={target} onChange={(e) => setTarget(e.target.value)} placeholder="+91… or you@example.com" />
            <button onClick={requestCode} disabled={busy || !target}>Get OTP</button>
          </>
        ) : (
          <>
            <label>6-digit code sent to {target}</label>
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="••••••" inputMode="numeric" maxLength={6} />
            <button onClick={verify} disabled={busy || code.length !== 6}>Sign in</button>
          </>
        )}
        {err && <p className="err-text">{err}</p>}
        <p className="muted">New here? Signing in with your registered phone creates your account automatically.</p>
      </div>
    </div>
  );
}
