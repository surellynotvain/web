"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { OAuthProvider } from "@/lib/oauth";

const providerLabels: Record<OAuthProvider, string> = {
  github: "github",
  microsoft: "microsoft",
};

export function LoginForm({
  csrf,
  errorHint,
  providers,
}: {
  csrf: string;
  errorHint?: string;
  providers: OAuthProvider[];
}) {
  const router = useRouter();
  const [usernameOrEmail, setUsernameOrEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(
    errorHint ? decodeURIComponent(errorHint) : null,
  );
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usernameOrEmail, password, csrf }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "login failed");
      }
      router.push("/");
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-8 space-y-4">
      <form onSubmit={submit} className="space-y-3" noValidate>
        <label htmlFor="login-username" className="sr-only">
          username or email
        </label>
        <input
          id="login-username"
          type="text"
          value={usernameOrEmail}
          onChange={(e) => setUsernameOrEmail(e.target.value)}
          placeholder="username or email"
          autoComplete="username"
          required
          aria-invalid={err ? true : undefined}
          className="w-full px-3 h-10 rounded-md border border-default bg-app focus:outline-none focus:ring-2 focus:ring-[rgb(var(--accent-light))] focus:border-transparent text-sm"
        />
        <label htmlFor="login-password" className="sr-only">
          password
        </label>
        <input
          id="login-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="password"
          autoComplete="current-password"
          required
          aria-invalid={err ? true : undefined}
          className="w-full px-3 h-10 rounded-md border border-default bg-app focus:outline-none focus:ring-2 focus:ring-[rgb(var(--accent-light))] focus:border-transparent text-sm"
        />
        {err && (
          <p role="alert" className="text-xs font-mono text-[rgb(220_60_80)]">
            {err}
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="btn-primary w-full disabled:opacity-60"
        >
          {busy ? "signing in…" : "sign in"}
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
