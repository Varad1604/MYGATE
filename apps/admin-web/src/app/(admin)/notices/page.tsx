"use client";

import { useCallback, useEffect, useState } from "react";
import { get, post } from "@/lib/api";
import { useRequireSession } from "@/lib/session";

interface Notice {
  id: string; title: string; type: string; audience: string;
  status: string; publishAt: string; requireAcknowledgement: boolean;
}

export default function NoticesPage() {
  const session = useRequireSession();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState("ALL");
  const [type, setType] = useState("ANNOUNCEMENT");
  const [ack, setAck] = useState(false);
  const [scheduleAt, setScheduleAt] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (cid: string) => {
    try {
      setNotices(await get<Notice[]>(`/communities/${cid}/notices`));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Load failed");
    }
  }, []);

  useEffect(() => {
    if (!session) return;
    void load(session.communityId);
  }, [session, load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!session) return;
    setBusy(true);
    setErr(null);
    try {
      await post(`/communities/${session.communityId}/notices`, {
        title, body, type, audience,
        requireAcknowledgement: ack,
        ...(scheduleAt ? { publishAt: new Date(scheduleAt).toISOString() } : {}),
      });
      setTitle(""); setBody(""); setScheduleAt(""); setAck(false);
      await load(session.communityId);
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h1>Notices</h1>
      {err && <div className="error">{err}</div>}
      <div className="card">
        <form onSubmit={create}>
          <div style={{ marginBottom: 8 }}>
            <input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} required minLength={3} />
          </div>
          <div style={{ marginBottom: 8 }}>
            <textarea placeholder="Body" rows={3} value={body} onChange={(e) => setBody(e.target.value)} required minLength={3} />
          </div>
          <div className="row" style={{ marginBottom: 10 }}>
            <select value={type} onChange={(e) => setType(e.target.value)} style={{ width: 160 }}>
              {["ANNOUNCEMENT", "EVENT", "MAINTENANCE", "EMERGENCY", "SECURITY", "BILLING_REMINDER"].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
            <select value={audience} onChange={(e) => setAudience(e.target.value)} style={{ width: 160 }}>
              {["ALL", "OWNERS", "TENANTS"].map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
            <label className="muted" style={{ fontSize: 12 }}>
              <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} style={{ width: "auto" }} /> ACK required
            </label>
            <input
              type="datetime-local"
              value={scheduleAt}
              onChange={(e) => setScheduleAt(e.target.value)}
              style={{ width: 220 }}
              title="Leave empty to publish now"
            />
            <button type="submit" disabled={busy}>{busy ? "Publishingâ€¦" : scheduleAt ? "Schedule" : "Publish now"}</button>
          </div>
        </form>
      </div>
      <div className="card">
        <div className="table-wrap"><table className="data">
          <thead><tr><th>Title</th><th>Type</th><th>Audience</th><th>Status</th><th>Publish at</th><th>ACK</th></tr></thead>
          <tbody>
            {notices.map((n) => (
              <tr key={n.id}>
                <td>{n.title}</td>
                <td className="muted">{n.type}</td>
                <td>{n.audience}</td>
                <td>
                  <span className={`pill ${n.status === "PUBLISHED" ? "ok" : n.status === "EXPIRED" ? "" : "warn"}`}>{n.status}</span>
                </td>
                <td className="muted">{new Date(n.publishAt).toLocaleString("en-IN")}</td>
                <td>{n.requireAcknowledgement ? "yes" : "â€”"}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </div>
    </>
  );
}
