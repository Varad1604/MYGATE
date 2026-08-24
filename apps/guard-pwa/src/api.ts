import { ApiClient } from "@societyos/api-client";

const TOKEN_KEY = "sos.guard.tokens";
export const api = new ApiClient(
  import.meta.env.VITE_API_URL ?? "/api/v1",
  (tokens) => localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens)),
  () => { localStorage.removeItem(TOKEN_KEY); location.hash = "#/login"; },
);

export function loadTokens(): void {
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    if (raw) api.setTokens(JSON.parse(raw) as Record<string, string>);
  } catch { /* corrupt storage — ignore */ }
}

/** Offline guard queue: operations recorded locally, flushed when back online. */
interface QueuedOp {
  id: string;
  kind: "check-in" | "check-out";
  payload: unknown;
  queuedAt: number;
}

const QUEUE_KEY = "sos.guard.offline-queue";

export function readQueue(): QueuedOp[] {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "[]") as QueuedOp[]; }
  catch { return []; }
}

function writeQueue(q: QueuedOp[]): void {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
}

export function enqueueOffline(kind: QueuedOp["kind"], payload: unknown): void {
  const q = readQueue();
  q.push({ id: crypto.randomUUID(), kind, payload, queuedAt: Date.now() });
  writeQueue(q);
}

export async function flushQueue(): Promise<{ flushed: number; remaining: number }> {
  const q = readQueue();
  if (!q.length) return { flushed: 0, remaining: 0 };
  const remaining: QueuedOp[] = [];
  let flushed = 0;
  for (const op of q) {
    try {
      if (op.kind === "check-in") await api.post("/gate/visitors/check-in", op.payload);
      else await api.post("/gate/visitors/check-out", op.payload);
      flushed++;
    } catch (e) {
      // Permanent failures are dropped with a console note; transient stay queued.
      if ((e as { code?: string }).code !== "NETWORK_ERROR") {
        console.warn("Dropping permanently-failed offline op", op.id, e);
        flushed++;
      } else {
        remaining.push(op);
      }
    }
  }
  writeQueue(remaining);
  return { flushed, remaining: remaining.length };
}
