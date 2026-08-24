"use client";

import { useEffect, useState } from "react";

export interface SessionInfo {
  userId: string;
  name: string;
  communityId: string;
  communityName: string;
}

const KEY = "societyos.admin.session";

/** Reads/writes tokens through the api-client and tracks who is signed in. */
export function getSession(): SessionInfo | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(KEY);
  return raw ? (JSON.parse(raw) as SessionInfo) : null;
}

export function setSession(s: SessionInfo) {
  window.localStorage.setItem(KEY, JSON.stringify(s));
}

export function clearSession() {
  window.localStorage.removeItem(KEY);
  window.localStorage.removeItem("societyos.tokens");
}

/**
 * Client-side auth gate: redirects to /login when no session exists.
 * (Server-enforced authorization still happens on every API call.)
 */
export function useRequireSession(): SessionInfo | null {
  const [session, setS] = useState<SessionInfo | null>(null);
  const [checked, setChecked] = useState(false);
  useEffect(() => {
    const s = getSession();
    if (!s) {
      window.location.href = "/login";
      return;
    }
    setS(s);
    setChecked(true);
  }, []);
  return checked ? session : null;
}
