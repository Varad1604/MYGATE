"use client";

import { useEffect, useState } from "react";
import { get } from "@/lib/api";
import { useRequireSession } from "@/lib/session";

interface Resident {
  userId: string; fullName: string; phone: string | null; email: string | null;
}

export default function ResidentsPage() {
  const session = useRequireSession();
  const [residents, setResidents] = useState<Resident[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    get<Resident[]>(`/communities/${session.communityId}/residents`)
      .then(setResidents)
      .catch((e) => setErr(e instanceof Error ? e.message : "Load failed"));
  }, [session]);

  return (
    <>
      <h1>Residents</h1>
      {err && <div className="error">{err}</div>}
      <div className="card">
        <div className="table-wrap"><table className="data">
          <thead><tr><th>Name</th><th>Phone</th><th>Email</th></tr></thead>
          <tbody>
            {residents.map((r) => (
              <tr key={r.userId}>
                <td>{r.fullName}</td>
                <td className="muted">{r.phone ?? "â€”"}</td>
                <td className="muted">{r.email ?? "â€”"}</td>
              </tr>
            ))}
            {!residents.length && <tr><td colSpan={3} className="muted">No residents found.</td></tr>}
          </tbody>
        </table></div>
      </div>
    </>
  );
}
