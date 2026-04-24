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

type ConfirmOptions = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

type ConfirmCtx = {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
};

const Ctx = createContext<ConfirmCtx | null>(null);

export function useConfirm(): ConfirmCtx["confirm"] {
  const ctx = useContext(Ctx);
  if (!ctx) {
    // fail-soft fallback — only fires if provider is missing
    return async (opts) => {
      if (typeof window === "undefined") return false;
      return window.confirm(opts.message);
    };
  }
  return ctx.confirm;
}

type Pending = {
  opts: ConfirmOptions;
  resolve: (value: boolean) => void;
};

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);
  const lastFocusedRef = useRef<Element | null>(null);

  const confirm = useCallback((opts: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      lastFocusedRef.current = document.activeElement;
      setPending({ opts, resolve });
    });
  }, []);

  const close = useCallback(
    (value: boolean) => {
      if (pending) pending.resolve(value);
      setPending(null);
      // restore focus
      window.setTimeout(() => {
        if (lastFocusedRef.current instanceof HTMLElement) {
          lastFocusedRef.current.focus();
        }
      }, 0);
    },
    [pending],
  );

  // focus confirm button on open + ESC to cancel
  useEffect(() => {
    if (!pending) return;
    confirmBtnRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pending, close]);

  // prevent body scroll while open
  useEffect(() => {
    if (!pending) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [pending]);

  const api = useMemo<ConfirmCtx>(() => ({ confirm }), [confirm]);

  return (
    <Ctx.Provider value={api}>
      {children}
      {pending && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-title"
          aria-describedby="confirm-message"
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-fade-up"
        >
          <div
            className="absolute inset-0 bg-[rgb(0_0_0/0.45)] backdrop-blur-sm"
            onClick={() => close(false)}
          />
          <div className="relative bg-app border border-default rounded-xl shadow-xl max-w-md w-full p-6">
            <h2
              id="confirm-title"
              className="text-lg font-semibold tracking-tight mb-2"
            >
              {pending.opts.title ?? "are you sure?"}
            </h2>
            <p id="confirm-message" className="text-sm text-muted leading-relaxed">
              {pending.opts.message}
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => close(false)}
                className="btn-ghost"
              >
                {pending.opts.cancelLabel ?? "cancel"}
              </button>
              <button
                ref={confirmBtnRef}
                type="button"
                onClick={() => close(true)}
                className={
                  pending.opts.destructive
                    ? "inline-flex items-center gap-2 h-9 px-4 rounded-md text-sm font-medium text-white transition-colors bg-[rgb(220_60_80)] hover:bg-[rgb(200_50_70)]"
                    : "btn-primary"
                }
              >
                {pending.opts.confirmLabel ??
                  (pending.opts.destructive ? "delete" : "confirm")}
              </button>
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}
