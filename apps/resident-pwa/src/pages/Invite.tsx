import { useState } from "react";
import { api } from "../api";

const TYPES = ["GUEST", "DELIVERY", "CAB", "SERVICE_PROVIDER", "EVENT_GUEST", "OTHER"];

interface Created {
  invitation: { id: string; visitorName: string };
  qrToken: string;
  otpCode: string;
}

export default function Invite() {
  const [myUnits, setMyUnits] = useState<Array<{ unit: { id: string; label: string } }>>([]);
  const [unitId, setUnitId] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [type, setType] = useState("GUEST");
  const [vehicle, setVehicle] = useState("");
  const [created, setCreated] = useState<Created | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useState(() => {
    api.get<typeof myUnits>("/me/units").then((u) => {
      setMyUnits(u);
      if (u[0]) setUnitId(u[0].unit.id);
    }).catch(() => {});
  });

  return (
    <div>
      <h1>Invite a Visitor</h1>
      <div className="card">
        <label>For unit</label>
        <select value={unitId} onChange={(e) => setUnitId(e.target.value)}>
          {myUnits.map((u) => <option key={u.unit.id} value={u.unit.id}>{u.unit.label}</option>)}
        </select>
        <label>Visitor name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
        <label>Visitor phone</label>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" />
        <label>Type</label>
        <select value={type} onChange={(e) => setType(e.target.value)}>
          {TYPES.map((t) => <option key={t}>{t.replace(/_/g, " ")}</option>)}
        </select>
        <label>Vehicle (optional)</label>
        <input value={vehicle} onChange={(e) => setVehicle(e.target.value)} />
        <button
          disabled={!unitId || name.trim().length < 2 || !phone}
          onClick={async () => {
            setErr(null);
            try {
              setCreated(await api.post<Created>(`/communities/${(await api.get<{ communityId: string }>("/auth/me")).communityId}/visitors/invitations`, {
                unitId, visitorName: name, visitorPhone: phone, visitorType: type,
                vehicleNumber: vehicle || undefined,
              }));
              setName(""); setPhone(""); setVehicle("");
            } catch (e) { setErr((e as Error).message); }
          }}
        >
          Generate pass
        </button>
        {err && <p className="err-text">{err}</p>}
      </div>

      {created && (
        <div className="card" style={{ borderColor: "#0d9488", borderWidth: 2 }}>
          <span className="badge">VALID 24 HOURS · single use</span>
          <p style={{ marginBottom: 4 }}><strong>{created.invitation.visitorName}</strong> can enter with either:</p>
          <label>Gate pass code (shown at gate)</label>
          <div className="code-box">{created.otpCode}</div>
          <details style={{ marginTop: 8 }}>
            <summary className="muted" style={{ cursor: "pointer" }}>QR payload</summary>
            <div className="code-box" style={{ fontSize: ".72rem", letterSpacing: 0 }}>{created.qrToken}</div>
          </details>
          <p className="muted">Share the code with your visitor. The guard scans or types it — no paperwork.</p>
        </div>
      )}
    </div>
  );
}
