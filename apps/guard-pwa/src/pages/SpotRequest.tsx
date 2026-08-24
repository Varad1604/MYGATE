import { useEffect, useState } from "react";
import { api } from "../api";
import { useOnlineStatus } from "./Home";

const VISITOR_TYPES = ["GUEST", "DELIVERY", "CAB", "SERVICE_PROVIDER", "CONTRACTOR", "DOMESTIC_HELP", "OTHER"];

interface UnitOption { id: string; label: string; tower: { code: string } }

export default function SpotRequest() {
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [gates, setGates] = useState<Array<{ id: string; name: string }>>([]);
  const [gateId, setGateId] = useState("");
  const [unitId, setUnitId] = useState("");
  const [visitorName, setVisitorName] = useState("");
  const [phone, setPhone] = useState("");
  const [type, setType] = useState("GUEST");
  const [vehicle, setVehicle] = useState("");
  const [result, setResult] = useState<{ expiresInSeconds: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const online = useOnlineStatus();

  useEffect(() => {
    api.get<UnitOption[]>("/gate/units").then(setUnits).catch(() => {});
    api.get<Array<{ id: string; name: string }>>("/gate/gates").then((g) => {
      setGates(g);
      if (g[0]) setGateId(g[0].id);
    }).catch(() => {});
  }, []);

  return (
    <div>
      <h1>Spot Visitor</h1>
      <div className="card">
        <label>Gate</label>
        <select value={gateId} onChange={(e) => setGateId(e.target.value)}>
          {gates.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          {!gates.length && <option value="">Loading…</option>}
        </select>
        <label>Unit</label>
        <select value={unitId} onChange={(e) => setUnitId(e.target.value)}>
          <option value="">Select unit…</option>
          {units.map((u) => (
            <option key={u.id} value={u.id}>{u.label}</option>
          ))}
        </select>
        <label>Visitor name</label>
        <input value={visitorName} onChange={(e) => setVisitorName(e.target.value)} placeholder="Full name" />
        <label>Phone (optional)</label>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" />
        <label>Type</label>
        <select value={type} onChange={(e) => setType(e.target.value)}>
          {VISITOR_TYPES.map((t) => <option key={t}>{t.replace(/_/g, " ")}</option>)}
        </select>
        <label>Vehicle number (optional)</label>
        <input value={vehicle} onChange={(e) => setVehicle(e.target.value)} />
        <button
          disabled={!unitId || visitorName.trim().length < 2 || !online || !gateId}
          onClick={async () => {
            setErr(null);
            try {
              const res = await api.post<{ invitation: { id: string }; expiresInSeconds: number }>(
                "/gate/visitors/spot-request",
                {
                  unitId, gateId, visitorName,
                  visitorPhone: phone || undefined,
                  visitorType: type,
                  vehicleNumber: vehicle || undefined,
                },
              );
              setResult({ expiresInSeconds: res.expiresInSeconds });
            } catch (e) { setErr((e as Error).message); }
          }}
        >
          Request approval
        </button>
        {!online && <p className="muted">Approval requests need connectivity.</p>}
        {err && <p className="err-text">{err}</p>}
        {result && (
          <div className="card" style={{ marginTop: 10 }}>
            <span className="badge waiting">
              WAITING APPROVAL · expires in {Math.max(1, Math.round(result.expiresInSeconds / 60))} min
            </span>
            <p className="muted">Resident notified in-app. Decision appears on the dashboard automatically.</p>
          </div>
        )}
      </div>
    </div>
  );
}
