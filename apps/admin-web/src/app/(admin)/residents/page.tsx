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
    // The residents endpoint returns a paged envelope: { items, total, page, pageSize }.
    get<{ items: Resident[]; total: number }>(`/communities/${session.communityId}/residents?pageSize=100`)
      .then((res) => setResidents(res.items ?? []))
      .catch(() => setErr("Couldn't load residents — retry by refreshing."));
  }, [session]);

  return (
    <>
      <h1>Residents</h1>
      {err && <div className="error-box">{err}</div>}
      <div className="table-wrap">
        <table className="data">
          <thead><tr><th>Name</th><th>Phone</th><th>Email</th></tr></thead>
          <tbody>
            {(Array.isArray(residents) ? residents : []).map((r) => (
              <tr key={r.userId}>
                <td>{r.fullName}</td>
                <td className="muted">{r.phone ?? "—"}</td>
                <td className="muted">{r.email ?? "—"}</td>
              </tr>
            ))}
            {!residents.length && <tr><td colSpan={3} className="muted">No residents found.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
