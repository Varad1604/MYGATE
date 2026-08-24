import { useCallback, useEffect, useState } from "react";
import { api } from "../api";

interface Invoice {
  id: string; reference: string; periodLabel: string; status: string;
  totalPaise: number; paidPaise: number; dueDate: string;
}

function inr(p: number): string {
  return `₹${(p / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
}

export default function Dues() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get<{ items: Invoice[] }>("/me/invoices?pageSize=30");
      setInvoices(res.items ?? []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Load failed");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function pay(inv: Invoice) {
    setBusyId(inv.id); setErr(null); setMsg(null);
    try {
      const payment = await api.post<{ id: string; providerOrderId: string; amountPaise: number }>(
        "/me/payments/initiate",
        { invoiceIds: [inv.id], method: "UPI" },
      );
      // Dev gateway simulation (server rejects this outside NODE_ENV=dev).
      await api.post("/__dev/payments/capture", { providerOrderId: payment.providerOrderId });
      setMsg(`Paid ${inr(payment.amountPaise)} — receipt generated.`);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Payment failed");
    } finally {
      setBusyId(null);
    }
  }

  const open = invoices.filter((i) => ["ISSUED", "PARTIALLY_PAID", "OVERDUE"].includes(i.status));
  const settled = invoices.filter((i) => !["ISSUED", "PARTIALLY_PAID", "OVERDUE"].includes(i.status));

  return (
    <div className="page">
      <h2>Maintenance dues</h2>
      {msg && <div style={{ color: "var(--ok)", fontSize: "0.85rem", marginBottom: 8 }}>{msg}</div>}
      {err && <div style={{ color: "var(--danger)", fontSize: "0.85rem", marginBottom: 8 }}>{err}</div>}
      {!open.length && <p className="muted">🎉 Nothing due. You're all settled!</p>}
      {open.map((inv) => {
        const outstanding = inv.totalPaise - inv.paidPaise;
        return (
          <div key={inv.id} className="card">
            <strong>{inv.reference}</strong>
            <div className="muted">
              {inv.periodLabel} · due {new Date(inv.dueDate).toLocaleDateString("en-IN")} ·{" "}
              {outstanding < inv.totalPaise ? `partially paid ${inr(inv.paidPaise)} · ` : ""}
              <strong style={{ color: "var(--warn)" }}>{inr(outstanding)}</strong> {inv.status === "OVERDUE" ? "· OVERDUE" : ""}
            </div>
            <button
              onClick={() => pay(inv)}
              disabled={busyId === inv.id}
              style={{ marginTop: 8, width: "100%" }}
            >
              {busyId === inv.id ? "Processing…" : `Pay ${inr(outstanding)}`}
            </button>
          </div>
        );
      })}
      {settled.length > 0 && (
        <>
          <h2>Paid</h2>
          {settled.slice(0, 5).map((inv) => (
            <div key={inv.id} className="card">
              <span className="muted">{inv.reference} · {inv.periodLabel} · {inr(inv.totalPaise)}</span>{" "}
              <span style={{ color: "var(--ok)" }}>PAID</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
