import { useCallback, useEffect, useState } from "react";
import { api } from "../api";

interface Ticket {
  id: string; reference: string; title: string; status: string;
  priority: string; createdAt: string;
  category?: { name: string };
  satisfactionRating?: number | null;
}

interface Category { id: string; name: string }

export default function Help() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [catId, setCatId] = useState("");
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [noSociety, setNoSociety] = useState(false);

  const load = useCallback(async () => {
    try {
      // /auth/me returns the access context FLAT: { userId, communityId, ... }.
      const me = await api.get<{ communityId?: string }>("/auth/me");
      if (!me.communityId) {
        setNoSociety(true);
        return;
      }
      setNoSociety(false);
      const [cats, mine] = await Promise.all([
        api.get<Category[]>(`/communities/${me.communityId}/ticket-categories`),
        api.get<{ items: Ticket[] }>("/me/tickets?pageSize=20"),
      ]);
      setCategories(Array.isArray(cats) ? cats : []);
      if (cats[0] && !catId) setCatId(cats[0].id);
      setTickets(mine.items ?? []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Load failed");
    }
  }, [catId]);

  useEffect(() => { void load(); }, [load]);

  async function raise(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null); setMsg(null);
    try {
      const me = await api.get<{ communityId?: string }>("/auth/me");
      if (!me.communityId) {
        setErr("Join a society before raising tickets.");
        return;
      }
      await api.post(`/communities/${me.communityId}/tickets`, {
        categoryId: catId,
        title,
        description: desc,
        priority,
        clientEventId: crypto.randomUUID(),
      });
      setTitle(""); setDesc("");
      setMsg("Ticket raised — staff notified.");
      await load();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Could not raise ticket");
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(t: Ticket, status: string) {
    setErr(null);
    try {
      await api.post(`/tickets/${t.id}/status`, { status });
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Action failed");
    }
  }

  async function rate(t: Ticket, rating: number) {
    setErr(null);
    try {
      await api.post(`/tickets/${t.id}/rate`, { rating });
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Rate failed");
    }
  }

  return (
    <div className="page">
      {noSociety ? (
        <>
          <h2>You're not part of a society yet</h2>
          <div className="card">
            <p className="muted" style={{ marginTop: 0 }}>
              Your account works, but no society has added you as a resident yet.
              Once the society office adds your flat, tickets, dues and notices
              will appear here automatically.
            </p>
          </div>
        </>
      ) : (
        <>
          <h2>Raise a request</h2>
          <form onSubmit={raise} className="card">
            <select value={catId} onChange={(e) => setCatId(e.target.value)} required aria-label="Category">
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <input placeholder="What's the issue?" value={title} onChange={(e) => setTitle(e.target.value)} required minLength={5} />
            <textarea placeholder="Describe it (optional details)" rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} />
            <div style={{ display: "flex", gap: 8 }}>
              <select value={priority} onChange={(e) => setPriority(e.target.value)} aria-label="Priority">
                {["LOW", "MEDIUM", "HIGH", "URGENT"].map((p) => <option key={p}>{p}</option>)}
              </select>
              <button type="submit" disabled={busy}>{busy ? "Sending…" : "Raise ticket"}</button>
            </div>
            {msg && <div style={{ color: "var(--ok)", fontSize: "0.85rem", marginTop: 8 }}>{msg}</div>}
          </form>

          <h2>My tickets</h2>
          {err && <div style={{ color: "var(--danger)", fontSize: "0.85rem" }}>{err}</div>}
          {!tickets.length && <p className="muted">No tickets yet.</p>}
      {tickets.map((t) => (
        <div key={t.id} className="card">
          <strong>{t.title}</strong>
          <div className="muted">
            {t.reference} · {t.category?.name} · {t.status}
            {t.satisfactionRating != null && ` · ★ ${t.satisfactionRating}/5`}
          </div>
          {(t.status === "RESOLVED") && (
            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} onClick={() => rate(t, n)} style={{ padding: "4px 10px" }}>★{n}</button>
              ))}
              <button onClick={() => setStatus(t, "CLOSED")} style={{ flex: 1 }}>Close</button>
            </div>
          )}
          {(t.status === "CLOSED") && (
            <button onClick={() => setStatus(t, "REOPENED")} style={{ marginTop: 8 }}>Reopen</button>
          )}
        </div>
      ))}
        </>
      )}
    </div>
  );
}
