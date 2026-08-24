import { useCallback, useEffect, useState } from "react";
import { api, flushQueue, readQueue } from "../api";

interface GuardHome {
  currentlyInside: number;
  waitingApprovals: number;
  recent: Array<{
    id: string;
    visitorName: string;
    visitorType: string;
    status: string;
    gate?: { name: string };
    unit?: { label: string } | null;
    checkedInAt: string | null;
    checkedOutAt: string | null;
  }>;
}

export function useOnlineStatus() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);
  return online;
}

export default function Home() {
  const [data, setData] = useState<GuardHome | null>(null);
  const [queued, setQueued] = useState(0);
  const online = useOnlineStatus();

  const refresh = useCallback(() => {
    api.get<GuardHome>("/gate/home").then(setData).catch(() => {});
  }, []);

  useEffect(() => {
    refresh();
    setQueued(readQueue().length);
    const t = setInterval(refresh, 15_000);
    return () => clearInterval(t);
  }, [refresh]);

  useEffect(() => {
    if (online && readQueue().length) {
      flushQueue().then(({ remaining }) => {
        setQueued(remaining);
        refresh();
      });
    }
  }, [online, refresh]);

  return (
    <div>
      {!online && <div className="offline-pill">OFFLINE — entries will sync</div>}
      <h1>Gate Dashboard</h1>
      <div className="stat-row">
        <div className="stat"><div className="num">{data?.currentlyInside ?? "–"}</div><div className="lbl">Inside now</div></div>
        <div className="stat"><div className="num" style={{ color: "var(--warn)" }}>{data?.waitingApprovals ?? "–"}</div><div className="lbl">Awaiting approval</div></div>
      </div>
      {queued > 0 && (
        <div className="card">
          <span className="badge waiting">{queued} queued offline</span>
          <p className="muted">Will sync automatically when back online.</p>
        </div>
      )}
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Recent activity</h3>
        {(data?.recent ?? []).map((v) => (
          <div className="list-item" key={v.id}>
            <div>
              <strong>{v.visitorName}</strong>
              <div className="muted">{v.unit?.label ? `Unit ${v.unit.label} · ` : ""}{v.visitorType}</div>
            </div>
            <span className={`badge ${v.status === "CHECKED_IN" ? "in" : v.status === "CHECKED_OUT" ? "out" : "waiting"}`}>
              {v.status.replace(/_/g, " ")}
            </span>
          </div>
        ))}
        {data && data.recent.length === 0 && <p className="muted">No visits logged yet today.</p>}
      </div>
    </div>
  );
}
