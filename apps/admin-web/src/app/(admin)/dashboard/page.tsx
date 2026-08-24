"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { get, fmtPaise } from "@/lib/api";

interface Paged<T> { items: T[]; total: number }
interface InvoiceSummary { billedPaise: number; collectedPaise: number }

export default function DashboardPage() {
  const [stats, setStats] = useState<{
    residents: number | null; openTickets: number | null;
    outstanding: string | null; collected: string | null; visitsToday: number | null;
  }>({ residents: null, openTickets: null, outstanding: null, collected: null, visitsToday: null });
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const raw = window.localStorage.getItem("societyos.admin.session");
    const cid = raw ? (JSON.parse(raw) as { communityId: string }).communityId : "";
    (async () => {
      try {
        const [residents, tickets, invoices] = await Promise.all([
          get<unknown[]>(`/communities/${cid}/residents`).catch(() => []),
          get<Paged<unknown>>(`/communities/${cid}/tickets?status=OPEN&pageSize=1`),
          get<{ items: unknown[]; total: number; summary: InvoiceSummary }>(`/communities/${cid}/invoices?pageSize=1`),
        ]);
        setStats({
          residents: Array.isArray(residents) ? (residents as unknown[]).length : null,
          openTickets: tickets.total,
          outstanding: fmtPaise(invoices.summary.billedPaise - invoices.summary.collectedPaise),
          collected: fmtPaise(invoices.summary.collectedPaise),
          visitsToday: null,
        });
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Failed to load stats");
      }
    })();
  }, []);

  return (
    <>
      <h1>Dashboard</h1>
      {err && <div className="error">{err}</div>}
      <div className="stats">
        <div className="card stat"><div className="num">{stats.residents ?? "—"}</div><div className="lbl">Residents</div></div>
        <div className="card stat"><div className="num">{stats.openTickets ?? "—"}</div><div className="lbl">Open tickets</div><Link className="lbl" href="/tickets">view →</Link></div>
        <div className="card stat"><div className="num" style={{ color: "var(--warn)" }}>{stats.outstanding ?? "—"}</div><div className="lbl">Outstanding dues</div></div>
        <div className="card stat"><div className="num" style={{ color: "var(--ok)" }}>{stats.collected ?? "—"}</div><div className="lbl">Collected (period)</div></div>
      </div>
      <div className="card">
        <strong>Quick actions</strong>
        <div className="row" style={{ marginTop: 10 }}>
          <Link href="/notices"><button>Publish a notice</button></Link>
          <Link href="/tickets"><button className="ghost">Work helpdesk queue</button></Link>
          <Link href="/invoices"><button className="ghost">Review billing</button></Link>
        </div>
      </div>
    </>
  );
}
