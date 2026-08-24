"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { get, fmtPaise } from "@/lib/api";
import { useRequireSession } from "@/lib/session";

interface Paged<T> { items: T[]; total: number }
interface InvoiceRow { id: string; reference: string; status: string; totalPaise: number; dueDate: string; unit?: { label: string } }
interface TicketRow { id: string; reference: string; title: string; status: string; slaResolutionDueAt?: string | null }
interface Summary {
  residents: number; units: number; occupiedUnits: number;
  visitsToday: number; openTickets: number;
  dues: { billedPaise: number; collectedPaise: number; outstandingPaise: number };
}

function Kpi({ label, value, meta }: { label: string; value: React.ReactNode; meta?: React.ReactNode }) {
  return (
    <div className="kpi">
      <div className="k-label">{label}</div>
      <div className="k-value">{value}</div>
      {meta ? <div className="k-meta">{meta}</div> : null}
    </div>
  );
}

export default function DashboardPage() {
  const session = useRequireSession();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [overdue, setOverdue] = useState<InvoiceRow[]>([]);
  const [slaRisk, setSlaRisk] = useState<TicketRow[]>([]);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);

  function load() {
    if (!session) return;
    setLoading(true); setFailed(false);
    const cid = session.communityId;
    void (async () => {
      try {
        const [s, inv, tk] = await Promise.all([
          get<Summary>(`/communities/${cid}/reports/summary`),
          get<Paged<InvoiceRow>>(`/communities/${cid}/invoices?status=OVERDUE&pageSize=5`),
          get<Paged<TicketRow>>(`/communities/${cid}/tickets?status=OPEN&pageSize=5`),
        ]);
        setSummary(s);
        setOverdue(inv.items ?? []);
        setSlaRisk(tk.items ?? []);
      } catch {
        setFailed(true);
      } finally {
        setLoading(false);
      }
    })();
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [session]);

  return (
    <>
      <div className="page-head">
        <h1>Good day, {session?.name?.split(" ")[0] ?? "there"}</h1>
        <p>{session?.communityName} — here's what needs your attention.</p>
      </div>

      <div className="page-body">
        {loading && (
          <div className="kpis" aria-busy>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="kpi">
                <div className="skeleton" style={{ height: 12, width: "40%" }} />
                <div className="skeleton" style={{ height: 28, width: "30%", marginTop: 8 }} />
              </div>
            ))}
          </div>
        )}

        {failed && !loading && (
          <div className="error-box">
            Couldn't reach the server.
            <button className="btn sm secondary" onClick={load}>Retry</button>
          </div>
        )}

        {!loading && summary && (
          <div className="kpis">
            <Kpi label="Residents" value={summary.residents} meta={`${summary.occupiedUnits}/${summary.units} units occupied`} />
            <Kpi label="Open tickets" value={summary.openTickets} meta={<Link href="/tickets">view queue →</Link>} />
            <Kpi label="Visits today" value={summary.visitsToday} />
            <Kpi
              label="Outstanding dues"
              value={fmtPaise(summary.dues.outstandingPaise)}
              meta={`${fmtPaise(summary.dues.collectedPaise)} collected of ${fmtPaise(summary.dues.billedPaise)}`}
            />
          </div>
        )}

        {!loading && !failed && summary && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: "var(--s-4)" }}>
            <div className="card">
              <h3 className="card-title">Overdue invoices</h3>
              {overdue.length === 0 ? (
                <p className="muted" style={{ margin: 0 }}>Nothing overdue.</p>
              ) : (
                overdue.map((inv) => (
                  <div key={inv.id} className="row" style={{ justifyContent: "space-between", padding: "var(--s-2) 0", borderBottom: "1px solid var(--line)" }}>
                    <span><strong className="tnum">{inv.reference}</strong> · {inv.unit?.label ?? "—"}</span>
                    <span className="badge danger tnum">{fmtPaise(inv.totalPaise)}</span>
                  </div>
                ))
              )}
              <Link href="/invoices" style={{ display: "inline-block", marginTop: "var(--s-3)", color: "var(--accent)", fontSize: "var(--fs-sm)" }}>All invoices →</Link>
            </div>

            <div className="card">
              <h3 className="card-title">Tickets waiting on assignment</h3>
              {slaRisk.length === 0 ? (
                <p className="muted" style={{ margin: 0 }}>Queue is clear.</p>
              ) : (
                slaRisk.map((t) => (
                  <div key={t.id} className="row" style={{ justifyContent: "space-between", padding: "var(--s-2) 0", borderBottom: "1px solid var(--line)" }}>
                    <span><strong className="tnum">{t.reference}</strong> · {t.title}</span>
                    <span className="badge accent">OPEN</span>
                  </div>
                ))
              )}
              <Link href="/tickets" style={{ display: "inline-block", marginTop: "var(--s-3)", color: "var(--accent)", fontSize: "var(--fs-sm)" }}>Work the queue →</Link>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
