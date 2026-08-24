"use client";

import { useCallback, useEffect, useState } from "react";
import { get } from "@/lib/api";
import { useRequireSession } from "@/lib/session";

interface AuditRow {
  id: string; action: string; entityType: string; entityId: string | null;
  actorLabel: string | null; actorUserId: string | null;
  before: unknown; after: unknown; ip: string | null; createdAt: string;
}

export default function AuditPage() {
  const session = useRequireSession();
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async (cid: string, p: number) => {
    try {
      const res = await get<{ items: AuditRow[]; total: number }>(
        `/communities/${cid}/audit?page=${p}&pageSize=50`,
      );
      setRows(res.items);
      setTotal(res.total);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Load failed");
    }
  }, []);

  useEffect(() => {
    if (!session) return;
    void load(session.communityId, page);
  }, [session, page, load]);

  const pages = Math.max(1, Math.ceil(total / 50));

  return (
    <>
      <h1>Audit log <span className="muted" style={{ fontSize: 13 }}>(append-only)</span></h1>
      {err && <div className="error">{err}</div>}
      <div className="card">
        <table>
          <thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Entity</th><th>IP</th><th>After</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="muted">{new Date(r.createdAt).toLocaleString("en-IN")}</td>
                <td className="muted">{r.actorLabel ?? r.actorUserId?.slice(0, 8) ?? "system"}</td>
                <td><span className="pill">{r.action}</span></td>
                <td className="muted">{r.entityType}{r.entityId ? ` · ${r.entityId.slice(0, 8)}` : ""}</td>
                <td className="muted">{r.ip ?? "—"}</td>
                <td style={{ maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {r.after ? JSON.stringify(r.after) : "—"}
                </td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={6} className="muted">No audit events.</td></tr>}
          </tbody>
        </table>
        <div className="row" style={{ marginTop: 10 }}>
          <button className="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>← Prev</button>
          <span className="muted">Page {page} of {pages} ({total} events)</span>
          <button className="ghost" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next →</button>
        </div>
      </div>
    </>
  );
}
