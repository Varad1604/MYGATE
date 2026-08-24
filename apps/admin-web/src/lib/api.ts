"use client";

import { ApiClient } from "@societyos/api-client";
import { getSession } from "./session";

let client: ApiClient | null = null;

export function api(): ApiClient {
  if (!client) {
    // Same-origin by default: next.config.mjs proxies /api to the backend.
    client = new ApiClient(process.env.NEXT_PUBLIC_API_BASE ?? "/api/v1");
    // Rehydrate tokens persisted by the login page.
    const raw = typeof window !== "undefined" ? window.localStorage.getItem("societyos.tokens") : null;
    if (raw) {
      try {
        const t = JSON.parse(raw) as { accessToken: string; refreshToken: string };
        client.setTokens(t);
      } catch { /* ignore */ }
    }
  }
  return client;
}

export function persistTokens(accessToken: string, refreshToken: string) {
  window.localStorage.setItem("societyos.tokens", JSON.stringify({ accessToken, refreshToken }));
}

/** Small typed GET/POST helpers that surface ApiError messages. */
export async function get<T>(path: string): Promise<T> {
  return api().get<T>(path);
}
export async function post<T>(path: string, body?: unknown): Promise<T> {
  return api().post<T>(path, body ?? {});
}

export function fmtPaise(p: number): string {
  return `₹${(p / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export { getSession };
