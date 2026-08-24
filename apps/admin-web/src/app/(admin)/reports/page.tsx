"use client";

import { useEffect, useState } from "react";
import { get, fmtPaise } from "@/lib/api";
import { useRequireSession } from "@/lib/session";

interface Summary {
  residents: number; units: number; occupiedUnits: number;
  visitsToday: number; openTickets: number;
  ticketsByStatus: Record<string, number>;
  dues: { billedPaise: number; collectedPaise: number; outstandingPaise: number };
}
interface Collection { periodLabel: string; invoices: number; billedPaise: number; collectedPaise: number; outstandingPaise: number }
interface HelpdeskReport {
  totalTickets: number; byStatus: Record<string, number>;
  byCategory: Array<{ name: string; count: number }>;
  currentlyBreached: number;
}
interface VisitorReport {
  totalVisits: number; checkedOut: number;
  perDay: Array<{ date: string; count: number }>;
  byApprovalMethod: Record<string, number>;
}

export default function ReportsPage() {
  const session = useRequireSession();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [helpdesk, setHelpdesk] = useState<HelpdeskReport | null>(null);
  const [visitors, setVisitors] = useState<VisitorReport | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    const cid = session.communityId;
    (async () => {
      try {
        const [s, c, h, v] = await Promise.all([
          get<Summary>(`/communities/${cid}/reports/summary`),
          get<Collection[]>(`/communities/${cid}/reports/collections`),
          get<HelpdeskReport>(`/communities/${cid}/reports/helpdesk?days=30`),
          get<VisitorReport>(`/communities/${cid}/reports/visitors?days=30`),
        ]);
        setSummary(s); setCollections(c); setHelpdesk(h); setVisitors(v);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Load failed");
      }
    })();
  }, [session]);

  return (
    <>
      <h1>Reports</h1>
      {err && <div className="error">{err}</div>}
      {!summary && !err && <p className="muted">Loading…</p>}
      {summary && (
        <div className="stats">
          <div className="card stat"><div className="num">{summary.residents}</div><div className="lbl">Residents · {summary.occupiedUnits}/{summary.units} units occupied</div></div>
          <div className="card stat"><div className="num">{summary.openTickets}</div><div className="lbl">Open tickets</div></div>
          <div className="card stat"><div className="num">{summary.visitsToday}</div><div className="lbl">Visits today</div></div>
          <div className="card stat"><div className="num" style={{ color: summary.dues.outstandingPaise > 0 ? "var(--warn)" : "var(--ok)" }}>{fmtPaise(summary.dues.outstandingPaise)}</div><div className="lbl">Outstanding dues</div></div>
        </div>
      )}

      {collections.length > 0 && (
        <div className="card">
          <strong>Collections by billing period</strong>
          <table style={{ marginTop: 8 }}>
            <thead><tr><th>Period</th><th>Invoices</th><th>Billed</th><th>Collected</th><th>Outstanding</th></tr></thead>
            <tbody>
              {collections.map((c) => (
                <tr key={c.periodLabel}>
                  <td>{c.periodLabel}</td>
                  <td>{c.invoices}</td>
                  <td>{fmtPaise(c.billedPaise)}</td>
                  <td style={{ color: "var(--ok)" }}>{fmtPaise(c.collectedPaise)}</td>
                  <td style={{ color: c.outstandingPaise > 0 ? "var(--warn)" : undefined }}>{fmtPaise(c.outstandingPaise)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {helpdesk && (
        <div className="card">
          <strong>Helpdesk — last 30 days</strong>
          <div className="row" style={{ marginTop: 8 }}>
            <span className="pill">total {helpdesk.totalTickets}</span>
            {Object.entries(helpdesk.byStatus).map(([s, n]) => <span key={s} className={`pill ${["RESOLVED", "CLOSED"].includes(s) ? "ok" : "warn"}`}>{s}: {n}</span>)}
            <span className={`pill ${helpdesk.currentlyBreached ? "danger" : "ok"}`}>SLA breached now: {helpdesk.currentlyBreached}</span>
          </div>
          <div className="muted" style={{ marginTop: 8 }}>
            By category: {helpdesk.byCategory.map((c) => `${c.name} (${c.count})`).join(", ") || "—"}
          </div>
        </div>
      )}

      {visitors && (
        <div className="card">
          <strong>Visitor traffic — last 30 days</strong>
          <div className="muted" style={{ marginTop: 6 }}>
            {visitors.totalVisits} visits · {visitors.checkedOut} exited ·{" "}
            {Object.entries(visitors.byApprovalMethod).map(([m, n]) => `${m}: ${n}`).join(" · ")}
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 4, marginTop: 10, height: 60 }}>
            {visitors.perDay.map((d) => (
              <div key={d.date} title={`${d.date}: ${d.count}`} style={{ width: 18, background: "var(--accent)", height: `${Math.min(100, d.count * 20)}%`, borderRadius: 3 }} />
            ))}
            {!visitors.perDay.length && <span className="muted">no visits in window</span>}
          </div>
        </div>
      )}
    </>
  );
}
