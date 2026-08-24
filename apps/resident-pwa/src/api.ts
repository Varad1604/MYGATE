import { ApiClient } from "@societyos/api-client";

const TOKEN_KEY = "sos.resident.tokens";
export const api = new ApiClient(
  import.meta.env.VITE_API_URL ?? "/api/v1",
  (tokens) => localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens)),
  () => { localStorage.removeItem(TOKEN_KEY); location.hash = "#/login"; },
);

export function getAccessToken(): string | null {
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    if (!raw) return null;
    return (JSON.parse(raw) as { accessToken?: string }).accessToken ?? null;
  } catch { return null; }
}

export function loadTokens(): void {
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    if (raw) api.setTokens(JSON.parse(raw) as Record<string, string>);
  } catch { /* ignore corrupt storage */ }
}

/** Live SSE subscription with auto-reconnect; returns a cleanup fn. */
export function subscribeRealtime(
  accessToken: string,
  handlers: Record<string, (data: unknown) => void>,
): () => void {
  let es: EventSource | null = null;
  let closed = false;
  let retryTimer: number | undefined;

  const connect = () => {
    if (closed) return;
    // EventSource cannot send Authorization headers; the guard accepts the
    // short-lived access token as ?access_token= on this route only.
    es = new EventSource(`/api/v1/realtime/stream?access_token=${encodeURIComponent(accessToken)}`);
    es.onerror = () => {
      es?.close();
      if (!closed) retryTimer = window.setTimeout(connect, 3000);
    };
    for (const [event, handler] of Object.entries(handlers)) {
      es.addEventListener(event, (ev) => {
        try {
          const parsed = JSON.parse((ev as MessageEvent).data) as { data?: unknown };
          handler(parsed.data ?? parsed);
        } catch { /* ignore malformed frames */ }
      });
    }
  };
  connect();
  return () => {
    closed = true;
    if (retryTimer) clearTimeout(retryTimer);
    es?.close();
  };
}
