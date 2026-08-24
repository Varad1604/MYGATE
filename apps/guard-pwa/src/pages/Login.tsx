import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";

export default function Login() {
  const [target, setTarget] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"target" | "code">("target");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { setMe } = useAuth();
  const nav = useNavigate();

  async function requestCode() {
    setBusy(true); setErr(null);
    try {
      await api.post("/auth/request-otp", { target });
      setStage("code");
    } catch (e) {
      setErr((e as Error).message);
    } finally { setBusy(false); }
  }

  async function verify() {
    setBusy(true); setErr(null);
    try {
      const res = await api.post<{ accessToken: string; refreshToken: string; context: { roleKeys: string[]; communityId: string | null; fullName?: string } }>(
        "/auth/verify-otp", { target, code },
      );
      api.setTokens({ accessToken: res.accessToken, refreshToken: res.refreshToken });
      localStorage.setItem("sos.guard.tokens", JSON.stringify({ accessToken: res.accessToken, refreshToken: res.refreshToken }));
      if (!res.context.roleKeys.includes("GUARD") && !res.context.roleKeys.includes("SECURITY_MANAGER")) {
        setErr("This app is for gate staff only.");
        return;
      }
      setMe({
        userId: "", // /auth/me refetch fills it
        fullName: res.context.fullName ?? "",
        communityId: res.context.communityId,
        roleKeys: res.context.roleKeys,
      });
      nav("/", { replace: true });
    } catch (e) {
      setErr((e as Error).message);
    } finally { setBusy(false); }
  }

  return (
    <div>
      <h1>SocietyOS Guard</h1>
      <div className="card">
        {stage === "target" ? (
          <>
            <label>Phone number</label>
            <input value={target} onChange={(e) => setTarget(e.target.value)} placeholder="+91…" inputMode="tel" />
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
        <p className="muted">Gate operations run even when the network is down — entries queue locally and sync later.</p>
      </div>
    </div>
  );
}
