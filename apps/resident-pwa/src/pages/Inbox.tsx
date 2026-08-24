import { useCallback, useEffect, useState } from "react";
import { api } from "../api";

interface Notification {
  id: string;
  category: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

export default function Inbox() {
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);

  const load = useCallback(() => {
    api.get<{ items: Notification[]; unreadCount: number }>("/me/notifications")
      .then((r) => { setItems(r.items); setUnread(r.unreadCount); })
      .catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <h1>Inbox {unread > 0 && <span className="badge">{unread} new</span>}</h1>
      <div className="card">
        {items.length === 0 && <p className="muted">Nothing yet — visitor entries, parcels and notices land here.</p>}
        {items.map((n) => (
          <div
            className="list-item"
            key={n.id}
            style={{ cursor: n.readAt ? "default" : "pointer" }}
            onClick={() => {
              if (n.readAt) return;
              api.post(`/me/notifications/${n.id}/read`).then(load).catch(() => {});
            }}
          >
            <div>
              <strong>{n.title}</strong>
              <div className="muted">{n.body}</div>
            </div>
            {!n.readAt && <span className="badge urgent">new</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
