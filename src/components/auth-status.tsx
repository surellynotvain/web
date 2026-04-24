"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Me = { id: string; username: string; role: string } | null;

export function AuthStatus() {
  const router = useRouter();
  const [me, setMe] = useState<Me>(null);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (cancelled) return;
        setMe(j?.user ?? null);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClick = () => setOpen(false);
    window.addEventListener("click", onClick);
    return () => window.removeEventListener("click", onClick);
  }, [open]);

  if (!loaded) return null;

  if (!me) {
    return (
      <Link
        href="/login"
        className="hidden sm:inline-flex text-xs font-medium text-muted hover:text-[rgb(var(--fg))] transition-colors px-3 h-9 items-center"
      >
        log in
      </Link>
    );
  }

  return (
    <div
      className="relative"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="h-9 px-3 rounded-md border border-default flex items-center gap-2 text-xs font-medium hover:bg-surface transition-colors"
      >
        <span
          className="h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold"
          style={{
            background: "rgb(var(--accent))",
            color: "rgb(var(--bg))",
          }}
        >
          {me.username[0]?.toUpperCase() ?? "?"}
        </span>
        <span className="hidden sm:inline">{me.username}</span>
      </button>
      {open && (
        <div className="absolute right-0 top-11 w-48 rounded-md border border-default bg-app shadow-lg py-1 text-sm z-50">
          <div className="px-3 py-2 text-[11px] uppercase tracking-widest font-mono text-subtle">
            signed in
          </div>
          {me.role === "admin" && (
            <Link
              href="/admin"
              className="block px-3 py-2 hover:bg-surface transition-colors"
            >
              admin
            </Link>
          )}
          <Link
            href="/settings"
            className="block px-3 py-2 hover:bg-surface transition-colors"
          >
            settings
          </Link>
          <button
            type="button"
            onClick={async () => {
              await fetch("/api/auth/logout", { method: "POST" });
              setMe(null);
              setOpen(false);
              router.refresh();
            }}
            className="w-full text-left px-3 py-2 hover:bg-surface transition-colors"
          >
            log out
          </button>
        </div>
      )}
    </div>
  );
}
