"use client";

import { useCallback, useEffect, useState } from "react";
import { get, post } from "@/lib/api";
import { useRequireSession } from "@/lib/session";

interface Ticket {
  id: string; reference: string; title: string; status: string; priority: string;
  category: { name: string }; unit: { label: string };
  raisedBy: { fullName: string }; assignedTo?: { fullName: string } | null;
  createdAt: string;
}

const NEXT_ACTIONS: Record<string, Array<{ to: string; label: string }>> = {
  OPEN: [{ to: "IN_PROGRESS", label: "Start work" }],
  ASSIGNED: [{ to: "IN_PROGRESS", label: "Start work" }, { to: "RESOLVED", label: "Resolve" }],
  IN_PROGRESS: [{ to: "RESOLVED", label: "Resolve" }],
  RESOLVED: [{ to: "CLOSED", label: "Close" }],
  REOPENED: [{ to: "IN_PROGRESS", label: "Re-start work" }],
};

export default function TicketsPage() {
  const session = useRequireSession();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [filter, setFilter] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async (cid: string) => {
    try {
      const q = filter ? `&status=${filter}` : "";
      const res = await get<{ items: Ticket[] }>(`/communities/${cid}/tickets?pageSize=50${q}`);
      setTickets(res.items);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Load failed");
    }
  }, [filter]);

  useEffect(() => {
    if (!session) return;
    void load(session.communityId);
  }, [session, load]);

  async function act(tid: string, status: string) {
    if (!session) return;
    try {
      await post(`/tickets/${tid}/status`, { status });
      await load(session.communityId);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Action failed");
    }
  }

  return (
    <>
      <h1>Helpdesk</h1>
      <div className="row" style={{ marginBottom: 12 }}>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} style={{ width: 160 }}>
          <option value="">All statuses</option>
          {["OPEN", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "CLOSED", "REOPENED"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <span className="muted">{tickets.length} tickets</span>
      </div>
      {err && <div className="error">{err}</div>}
      <div className="card">
        <div className="table-wrap"><table className="data">
          <thead>
            <tr><th>Ref</th><th>Title</th><th>Unit</th><th>Category</th><th>Status</th><th>Priority</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {tickets.map((t) => (
              <tr key={t.id}>
                <td className="muted">{t.reference}</td>
                <td>{t.title}<br /><span className="muted">{t.raisedBy?.fullName ?? ""}</span></td>
                <td>{t.unit?.label}</td>
                <td>{t.category?.name}</td>
                <td><span className={`pill ${["RESOLVED", "CLOSED"].includes(t.status) ? "ok" : t.status === "OPEN" ? "danger" : "warn"}`}>{t.status}</span></td>
                <td>{t.priority}</td>
                <td>
                  <div className="row">
                    {(NEXT_ACTIONS[t.status] ?? []).map((a) => (
                      <button key={a.to} onClick={() => act(t.id, a.to)}>{a.label}</button>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
            {!tickets.length && (
              <tr><td colSpan={7} className="muted">No tickets{filter ? ` with status ${filter}` : ""}.</td></tr>
            )}
          </tbody>
        </table></div>
      </div>
    </>
  );
}
