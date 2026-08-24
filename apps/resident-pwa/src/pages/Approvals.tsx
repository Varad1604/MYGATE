import { useCallback, useEffect, useState } from "react";
import { api, getAccessToken, subscribeRealtime } from "../api";

interface PendingVisitor {
  id: string;
  visitorName: string;
  visitorType: string;
  vehicleNumber: string | null;
  unit?: { label: string };
  tower?: { code: string };
  createdAt: string;
}

/** Shape pushed by SSE visitor.approval_requested events. */
interface LiveApproval {
  invitationId: string;
  visitorName: string;
  visitorType: string;
  vehicleNumber: string | null;
  gateName: string;
  expiresInSeconds: number;
}

export default function Approvals() {
  const [pending, setPending] = useState<PendingVisitor[]>([]);
  const [live, setLive] = useState<LiveApproval[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(() => {
    api.get<PendingVisitor[]>("/me/visitors/pending").then(setPending).catch(() => {});
  }, []);

  useEffect(() => {
    load();
    const token = getAccessToken();
    if (!token) return;
    // Realtime: new spot requests appear instantly; decided ones disappear.
    const unsubscribe = subscribeRealtime(token, {
      "visitor.approval_requested": (data) => {
        const d = data as LiveApproval;
        setLive((prev) => [...prev.filter((x) => x.invitationId !== d.invitationId), {
          invitationId: d.invitationId,
          visitorName: d.visitorName,
          visitorType: d.visitorType,
          vehicleNumber: d.vehicleNumber,
          gateName: d.gateName,
          expiresInSeconds: d.expiresInSeconds,
        }]);
      },
      "visitor.checked_in": () => { setLive([]); load(); },
    });
    return unsubscribe;
  }, [load]);

  async function decide(id: string, decision: "approve" | "reject") {
    setBusyId(id);
    setNote(null);
    try {
      await api.post(`/me/visitors/${id}/${decision}`, {});
      setNote(decision === "approve" ? "Approved — the gate is updated instantly." : "Rejected.");
      setPending((p) => p.filter((x) => x.id !== id));
      setLive((p) => p.filter((x) => x.invitationId !== id));
    } catch (e) {
      setNote((e as Error).message);
    } finally { setBusyId(null); }
  }

  return (
    <div>
      <h1>Gate Approvals</h1>
      {live.map((v) => (
        <div className="card" key={v.invitationId} style={{ borderColor: "#f59e0b" }}>
          <span className="badge urgent">LIVE · {Math.max(1, Math.ceil(v.expiresInSeconds / 15))}s left</span>
          <div className="list-item">
            <div>
              <strong>{v.visitorName}</strong>
              <div className="muted">{v.visitorType.replace(/_/g, " ")} · at {v.gateName}</div>
            </div>
          </div>
          <div className="row-btns">
            <button className="approve" disabled={busyId === v.invitationId} onClick={() => decide(v.invitationId, "approve")}>Allow in</button>
            <button className="reject" disabled={busyId === v.invitationId} onClick={() => decide(v.invitationId, "reject")}>Deny</button>
          </div>
        </div>
      ))}
      {pending.length === 0 && live.length === 0 && (
        <div className="card"><p className="muted">No pending requests. When a visitor arrives at the gate for your unit, they appear here instantly.</p></div>
      )}
      {pending.map((v) => (
        <div className="card" key={v.id}>
          <div className="list-item">
            <div>
              <strong>{v.visitorName}</strong>
              <div className="muted">{v.visitorType.replace(/_/g, " ")}{v.unit ? ` · ${v.unit.label}` : ""}</div>
            </div>
            <span className="badge">waiting</span>
          </div>
          <div className="row-btns">
            <button className="approve" disabled={busyId === v.id} onClick={() => decide(v.id, "approve")}>Approve</button>
            <button className="reject" disabled={busyId === v.id} onClick={() => decide(v.id, "reject")}>Reject</button>
          </div>
        </div>
      ))}
      {note && <p className="muted">{note}</p>}
    </div>
  );
}
