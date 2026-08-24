import { useState } from "react";
import { api, enqueueOffline, readQueue } from "../api";
import { useOnlineStatus } from "./Home";

type Outcome =
  | { kind: "ok"; text: string }
  | { kind: "err"; text: string };

export default function CheckInOut() {
  const [credential, setCredential] = useState("");
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [visitId, setVisitId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const online = useOnlineStatus();

  async function doCheckIn() {
    setBusy(true); setOutcome(null);
    const value = credential.trim();
    // Credential forms: raw QR token, 6-digit OTP, or a pasted visit/invitation UUID.
    const payload: Record<string, unknown> = { clientEventId: crypto.randomUUID() };
    if (/^\d{6}$/.test(value)) payload.otp = value;
    else if (/^[0-9a-f-]{36}$/i.test(value)) payload.invitationId = value;
    else payload.token = value;
    try {
      if (!online) {
        enqueueOffline("check-in", payload);
        setOutcome({ kind: "ok", text: "Offline — entry queued and will sync automatically." });
      } else {
        const res = await api.post<{ visit: { id: string; visitorName: string; unit?: { label: string } | null } }>(
          "/gate/visitors/check-in", payload,
        );
        setVisitId(res.visit.id);
        setOutcome({ kind: "ok", text: `${res.visit.visitorName} checked in${res.visit.unit ? ` · ${res.visit.unit.label}` : ""}` });
      }
      setCredential("");
    } catch (e) {
      setOutcome({ kind: "err", text: (e as Error).message });
    } finally { setBusy(false); }
  }

  async function doCheckOut() {
    if (!visitId) return;
    setBusy(true);
    try {
      await api.post("/gate/visitors/check-out", { visitId, clientEventId: crypto.randomUUID() });
      setOutcome({ kind: "ok", text: "Visitor checked out." });
      setVisitId(null);
    } catch (e) {
      setOutcome({ kind: "err", text: (e as Error).message });
    } finally { setBusy(false); }
  }

  return (
    <div>
      <h1>Entry / Exit</h1>
      <div className="card">
        <label>Scan QR, enter 6-digit code, or paste invitation ID</label>
        <textarea
          value={credential}
          onChange={(e) => setCredential(e.target.value)}
          rows={3}
          placeholder="Token / OTP / invitation id"
        />
        <button onClick={doCheckIn} disabled={busy || !credential.trim()}>Check in</button>

        {outcome && (
          <div className={`card ${outcome.kind === "ok" ? "" : ""}`} style={{ marginTop: 10 }}>
            <span className={outcome.kind === "ok" ? "ok-text" : "err-text"} style={{ fontWeight: 700 }}>
              {outcome.kind === "ok" ? "✓ " : "✕ "}{outcome.text}
            </span>
            {visitId && (
              <>
                <p className="muted">Visitor is inside now.</p>
                <button className="danger" onClick={doCheckOut} disabled={busy}>Check out this visitor</button>
              </>
            )}
          </div>
        )}

        <p className="muted">
          {readQueue().length > 0 && `${readQueue().length} offline entries queued. `}
          Offline check-ins are recorded on-device with an idempotency ID — no double entries when they sync.
        </p>
      </div>
    </div>
  );
}
