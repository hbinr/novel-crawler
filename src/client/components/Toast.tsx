// 全局 toast — 简易实现
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import "./Toast.css";

type Kind = "info" | "success" | "error" | "warn";
interface ToastItem {
  id: number;
  kind: Kind;
  title?: string;
  msg: string;
  leaving?: boolean;
}
interface Ctx {
  push: (t: Omit<ToastItem, "id">) => void;
}
const ToastCtx = createContext<Ctx | null>(null);

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const push = useCallback((t: Omit<ToastItem, "id">) => {
    const id = nextId++;
    setItems((prev) => [...prev, { id, ...t }]);
    setTimeout(() => {
      setItems((prev) => prev.map((x) => (x.id === id ? { ...x, leaving: true } : x)));
      setTimeout(() => {
        setItems((prev) => prev.filter((x) => x.id !== id));
      }, 200);
    }, 3000);
  }, []);

  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      <div className="toast-stack">
        {items.map((t) => (
          <div
            key={t.id}
            className={`toast toast-${t.kind} ${t.leaving ? "leaving" : ""}`}
            onClick={() => setItems((prev) => prev.filter((x) => x.id !== t.id))}
          >
            {t.title && <div className="toast-title">{t.title}</div>}
            <div className="toast-msg">{t.msg}</div>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast outside provider");
  return ctx;
}
