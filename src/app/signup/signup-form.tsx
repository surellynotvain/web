"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { OAuthProvider } from "@/lib/oauth";

const providerLabels: Record<OAuthProvider, string> = {
  github: "github",
  microsoft: "microsoft",
};

export function SignupForm({
  csrf,
  providers,
}: {
  csrf: string;
  providers: OAuthProvider[];
}) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [leakWarning, setLeakWarning] = useState<boolean>(false);
  const debounce = useRef<NodeJS.Timeout | null>(null);

  // live-check password against leaked list (debounced)
  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    if (password.length < 4) {
      setLeakWarning(false);
      return;
    }
    debounce.current = setTimeout(async () => {
      try {
        const res = await fetch("/api/auth/check-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
        });
        if (!res.ok) return;
        const j = (await res.json()) as { leaked?: boolean };
        setLeakWarning(Boolean(j.leaked));
      } catch {
        /* ignore */
      }
    }, 450);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [password]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password, csrf }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "signup failed");
      }
      router.push("/");
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "signup failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-8 space-y-4">
      <form onSubmit={submit} className="space-y-3" noValidate>
        <label htmlFor="signup-username" className="sr-only">
          username
        </label>
        <input
          id="signup-username"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="username"
          pattern="[A-Za-z0-9_\-]{3,24}"
          title="3–24 chars: letters, numbers, underscore, hyphen"
          autoComplete="username"
          required
          className="w-full px-3 h-10 rounded-md border border-default bg-app focus:outline-none focus:ring-2 focus:ring-[rgb(var(--accent-light))] focus:border-transparent text-sm"
        />
        <label htmlFor="signup-email" className="sr-only">
          email (optional)
        </label>
        <input
          id="signup-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email (optional)"
          autoComplete="email"
          className="w-full px-3 h-10 rounded-md border border-default bg-app focus:outline-none focus:ring-2 focus:ring-[rgb(var(--accent-light))] focus:border-transparent text-sm"
        />
        <div>
          <label htmlFor="signup-password" className="sr-only">
            password
          </label>
          <input
            id="signup-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="password (min 8 chars)"
            minLength={8}
            autoComplete="new-password"
            required
            aria-invalid={leakWarning || err ? true : undefined}
            aria-describedby={leakWarning ? "signup-password-warn" : undefined}
            className={`w-full px-3 h-10 rounded-md border bg-app focus:outline-none focus:ring-2 focus:border-transparent text-sm transition-colors ${
              leakWarning
                ? "border-[rgb(220_60_80)] focus:ring-[rgb(220_60_80)]"
                : "border-default focus:ring-[rgb(var(--accent-light))]"
            }`}
          />
          {leakWarning && (
            <p
              id="signup-password-warn"
              role="alert"
              className="mt-1.5 text-[11px] font-mono text-[rgb(220_60_80)] leading-snug"
            >
              this password shows up in a known data breach. pick something
              else — a passphrase works, or use a manager.
            </p>
          )}
        </div>
        {err && (
          <p role="alert" className="text-xs font-mono text-[rgb(220_60_80)]">
            {err}
          </p>
        )}
        <button
          type="submit"
          disabled={busy || leakWarning}
          className="btn-primary w-full disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {busy ? "creating…" : "create account"}
        </button>
      </form>

      {providers.length > 0 && (
        <>
          <div className="flex items-center gap-3 my-6">
            <div className="h-px bg-default flex-1" />
            <span className="font-mono text-[10px] uppercase tracking-widest text-subtle">
              or
            </span>
            <div className="h-px bg-default flex-1" />
          </div>
          <div className="space-y-2">
            {providers.map((p) => (
              <a
                key={p}
                href={`/api/auth/oauth/${p}`}
                className="btn-ghost w-full"
              >
                continue with {providerLabels[p]}
              </a>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
