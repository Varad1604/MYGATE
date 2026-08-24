"use client";

import { useCallback, useEffect, useState } from "react";
import { get, post, fmtPaise } from "@/lib/api";
import { useRequireSession } from "@/lib/session";

interface Invoice {
  id: string; reference: string; periodLabel: string; status: string;
  totalPaise: number; paidPaise: number; dueDate: string;
  unit: { label: string };
}

export default function InvoicesPage() {
  const session = useRequireSession();
  const [data, setData] = useState<{ items: Invoice[]; summary?: { billedPaise: number; collectedPaise: number } } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async (cid: string) => {
    try {
      setData(await get(`/communities/${cid}/invoices?pageSize=50`));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Load failed");
    }
  }, []);

  useEffect(() => {
    if (!session) return;
    void load(session.communityId);
  }, [session, load]);

  async function issue(inv: Invoice) {
    if (!session) return;
    try {
      await post(`/invoices/${inv.id}/issue`);
      await load(session.communityId);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Issue failed");
    }
  }

  async function cancel(inv: Invoice) {
    if (!session) return;
    const reason = window.prompt("Cancellation reason (min 5 chars):");
    if (!reason || reason.length < 5) return;
    try {
      await post(`/invoices/${inv.id}/cancel`, { reason });
      await load(session.communityId);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Cancel failed");
    }
  }

  return (
    <>
      <h1>Billing</h1>
      {err && <div className="error">{err}</div>}
      {data?.summary && (
        <div className="stats" style={{ marginBottom: 14 }}>
          <div className="card stat"><div className="num">{fmtPaise(data.summary.billedPaise)}</div><div className="lbl">Billed (filtered)</div></div>
          <div className="card stat"><div className="num" style={{ color: "var(--ok)" }}>{fmtPaise(data.summary.collectedPaise)}</div><div className="lbl">Collected</div></div>
        </div>
      )}
      <div className="card">
        <div className="table-wrap"><table className="data">
          <thead>
            <tr><th>Reference</th><th>Unit</th><th>Period</th><th>Total</th><th>Paid</th><th>Status</th><th>Due</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {(data?.items ?? []).map((inv) => (
              <tr key={inv.id}>
                <td className="muted">{inv.reference}</td>
                <td>{inv.unit?.label}</td>
                <td>{inv.periodLabel}</td>
                <td>{fmtPaise(inv.totalPaise)}</td>
                <td>{fmtPaise(inv.paidPaise)}</td>
                <td>
                  <span className={`pill ${inv.status === "PAID" ? "ok" : inv.status === "CANCELLED" ? "" : inv.status === "OVERDUE" ? "danger" : "warn"}`}>
                    {inv.status}
                  </span>
                </td>
                <td className="muted">{new Date(inv.dueDate).toLocaleDateString("en-IN")}</td>
                <td>
                  <div className="row">
                    {inv.status === "DRAFT" && <button onClick={() => issue(inv)}>Issue</button>}
                    {["DRAFT", "ISSUED"].includes(inv.status) && inv.paidPaise === 0 && (
                      <button className="btn ghost sm" onClick={() => cancel(inv)}>Cancel</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!data?.items.length && <tr><td colSpan={8} className="muted">No invoices yet â€” create a bill run via the API/seed.</td></tr>}
          </tbody>
        </table></div>
      </div>
    </>
  );
}
