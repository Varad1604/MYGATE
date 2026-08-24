"use client";

import { useEffect, useState } from "react";
import { get } from "@/lib/api";
import { useRequireSession } from "@/lib/session";

interface VehicleRow {
  id: string; number: string; type: string; color: string | null;
  unit?: { label: string } | null;
  allocations: Array<{ slot: { code: string; area: { name: string } } }>;
}

export default function ParkingPage() {
  const session = useRequireSession();
  const [vehicles, setVehicles] = useState<VehicleRow[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    get<VehicleRow[]>(`/communities/${session.communityId}/vehicles`)
      .then(setVehicles)
      .catch((e) => setErr(e instanceof Error ? e.message : "Load failed"));
  }, [session]);

  return (
    <>
      <h1>Parking & vehicles</h1>
      {err && <div className="error">{err}</div>}
      <div className="card">
        <div className="table-wrap"><table className="data">
          <thead><tr><th>Plate</th><th>Type</th><th>Color</th><th>Unit</th><th>Allocated slot</th></tr></thead>
          <tbody>
            {vehicles.map((v) => (
              <tr key={v.id}>
                <td>{v.number}</td>
                <td className="muted">{v.type}</td>
                <td className="muted">{v.color ?? "â€”"}</td>
                <td>{v.unit?.label ?? "â€”"}</td>
                <td>
                  {v.allocations[0]
                    ? `${v.allocations[0].slot.area.name} / ${v.allocations[0].slot.code}`
                    : <span className="muted">â€”</span>}
                </td>
              </tr>
            ))}
            {!vehicles.length && <tr><td colSpan={5} className="muted">No registered vehicles.</td></tr>}
          </tbody>
        </table></div>
      </div>
    </>
  );
}
