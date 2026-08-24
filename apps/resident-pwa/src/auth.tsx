import React, { createContext, useContext, useEffect, useState } from "react";
import { api, loadTokens } from "./api";

interface Me {
  userId: string;
  fullName: string;
  communityId: string | null;
  roleKeys: string[];
}

const AuthCtx = createContext<{ me: Me | null; setMe: (m: Me | null) => void; refresh: () => void }>({
  me: null,
  setMe: () => {},
  refresh: () => {},
});

export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = () => {
    api.get<Me>("/auth/me").then(setMe).catch(() => setMe(null));
  };

  useEffect(() => {
    loadTokens();
    api.get<Me>("/auth/me")
      .then(setMe)
      .catch(() => setMe(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="card">Loading…</div>;
  return <AuthCtx.Provider value={{ me, setMe, refresh }}>{children}</AuthCtx.Provider>;
}
