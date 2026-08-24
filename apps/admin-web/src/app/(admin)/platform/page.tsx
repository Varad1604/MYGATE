"use client";

import { useCallback, useEffect, useState } from "react";
import { get, post, api } from "@/lib/api";
import { useRequireSession } from "@/lib/session";

interface Community {
  id: string; name: string; slug: string; city: string; status: string;
  createdAt: string;
}

/**
 * Platform super-admin console. The API enforces
 * platform.communities.manage on every call â€” this page merely hides itself.
 */
export default function PlatformPage() {
  const session = useRequireSession();
  const [communities, setCommunities] = useState<Community[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [city, setCity] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setCommunities(await get<Community[]>("/platform/communities"));
    } catch (e) {
      // Non-platform admins get PERMISSION_DENIED â€” show the empty state.
      setCommunities(null);
      setErr(e instanceof Error ? e.message : "Load failed");
    }
  }, []);

  useEffect(() => {
    if (!session) return;
    void load();
  }, [session, load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      await post("/platform/communities", {
        name,
        slug,
        city,
        state: "Maharashtra",
        postalCode: "000000",
      });
      setName(""); setSlug(""); setCity("");
      await load();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(c: Community, status: "ACTIVE" | "SUSPENDED") {
    setErr(null);
    try {
      await api().patch(`/platform/communities/${c.id}/status`, { status });
      await load();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Status change failed");
    }
  }

  return (
    <>
      <h1>Platform console</h1>
      {err && <div className="error">{err}</div>}
      {communities === null && !session && <p className="muted">Loadingâ€¦</p>}
      {communities !== null && (
        <>
          <div className="card">
            <strong>Onboard a community</strong>
            <form onSubmit={create} style={{ marginTop: 8 }}>
              <div className="row">
                <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required minLength={3} style={{ width: 220 }} />
                <input placeholder="slug" value={slug} onChange={(e) => setSlug(e.target.value)} required pattern="[a-z0-9-]{3,40}" title="lowercase-kebab" style={{ width: 160 }} />
                <input placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} required minLength={2} style={{ width: 140 }} />
                <button type="submit" disabled={busy}>{busy ? "Creatingâ€¦" : "Create"}</button>
              </div>
            </form>
          </div>
          <div className="card">
            <div className="table-wrap"><table className="data">
              <thead><tr><th>Name</th><th>Slug</th><th>City</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {communities.map((c) => (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td className="muted">{c.slug}</td>
                    <td>{c.city}</td>
                    <td>
                      <span className={`pill ${c.status === "ACTIVE" ? "ok" : c.status === "SUSPENDED" ? "danger" : "warn"}`}>{c.status}</span>
                    </td>
                    <td>
                      <div className="row">
                        {c.status !== "SUSPENDED" && (
                          <button className="btn ghost sm" onClick={() => setStatus(c, "SUSPENDED")}>Suspend</button>
                        )}
                        {c.status === "SUSPENDED" && (
                          <button onClick={() => setStatus(c, "ACTIVE")}>Reactivate</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {!communities.length && <tr><td colSpan={5} className="muted">No communities yet.</td></tr>}
              </tbody>
            </table></div>
          </div>
        </>
      )}
    </>
  );
}
