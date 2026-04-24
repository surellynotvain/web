"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type ToastKind = "info" | "success" | "error";

type Toast = {
  id: number;
  kind: ToastKind;
  message: string;
  ttl: number;
};

type ToastCtx = {
  push: (msg: string, opts?: { kind?: ToastKind; ttl?: number }) => void;
  success: (msg: string) => void;
  error: (msg: string) => void;
  info: (msg: string) => void;
};

const Ctx = createContext<ToastCtx | null>(null);

export function useToast(): ToastCtx {
  const ctx = useContext(Ctx);
  if (!ctx) {
    // fail-soft: if mounted outside provider, log to console instead of crashing
    return {
      push: (m) => console.warn("[toast:no-provider]", m),
      success: (m) => console.warn("[toast:no-provider]", m),
      error: (m) => console.warn("[toast:no-provider]", m),
      info: (m) => console.warn("[toast:no-provider]", m),
    };
  }
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const remove = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const push = useCallback(
    (message: string, opts?: { kind?: ToastKind; ttl?: number }) => {
      const id = nextId.current++;
      const kind = opts?.kind ?? "info";
      const ttl = opts?.ttl ?? (kind === "error" ? 6000 : 3500);
      setToasts((t) => [...t, { id, kind, message, ttl }]);
      window.setTimeout(() => remove(id), ttl);
    },
    [remove],
  );

  const api = useMemo<ToastCtx>(
    () => ({
      push,
      success: (m) => push(m, { kind: "success" }),
      error: (m) => push(m, { kind: "error" }),
      info: (m) => push(m, { kind: "info" }),
    }),
    [push],
  );

  return (
    <Ctx.Provider value={api}>
      {children}
      <div
        role="region"
        aria-label="notifications"
        aria-live="polite"
        className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none max-w-[calc(100vw-2rem)]"
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onClose={() => remove(t.id)} />
        ))}
      </div>
    </Ctx.Provider>
  );
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setLeaving(true), toast.ttl - 300);
    return () => window.clearTimeout(t);
  }, [toast.ttl]);

  const kindClass =
    toast.kind === "success"
      ? "border-[rgb(var(--accent))] bg-[rgb(var(--accent)/0.1)]"
      : toast.kind === "error"
        ? "border-[rgb(220_60_80)] bg-[rgb(220_60_80/0.08)]"
        : "border-default bg-surface";

  return (
    <div
      role={toast.kind === "error" ? "alert" : "status"}
      className={`pointer-events-auto border rounded-lg px-4 py-3 shadow-sm text-sm backdrop-blur-sm min-w-[240px] max-w-sm transition-all duration-200 ${kindClass} ${
        leaving ? "opacity-0 translate-y-1" : "opacity-100"
      }`}
    >
      <div className="flex items-start gap-3">
        <span className="flex-1 break-words">{toast.message}</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="dismiss"
          className="text-subtle hover:text-[rgb(var(--fg))] transition-colors font-mono text-xs shrink-0"
        >
          ×
        </button>
      </div>
    </div>
  );
}
