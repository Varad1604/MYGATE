"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

interface Toast { id: number; msg: string; err?: boolean }
interface ToasterApi {
  toast: (msg: string) => void;
  error: (msg: string) => void;
}

const Ctx = createContext<ToasterApi>({ toast: () => {}, error: () => {} });

export function useToast(): ToasterApi {
  return useContext(Ctx);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);

  const push = useCallback((msg: string, err = false) => {
    const id = Date.now() + Math.random();
    setItems((cur) => [...cur.slice(-3), { id, msg, err }]);
    setTimeout(() => setItems((cur) => cur.filter((t) => t.id !== id)), 4000);
  }, []);

  const api = useMemo<ToasterApi>(
    () => ({
      toast: (m: string) => push(m, false),
      error: (m: string) => push(m, true),
    }),
    [push],
  );

  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="toaster" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast${t.err ? " err" : ""}`}>{t.msg}</div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
