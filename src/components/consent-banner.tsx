"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CONSENT_COOKIE,
  CONSENT_COOKIE_MAX_AGE,
  CONSENT_VERSION,
  DEFAULT_CONSENT,
  isStale,
  parseConsent,
  serializeConsent,
  type ConsentState,
} from "@/lib/consent";

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(
    new RegExp("(?:^|; )" + name.replace(/([.$?*|{}()[\]\\/+^])/g, "\\$1") + "=([^;]*)"),
  );
  return m ? m[1] : null;
}

function writeCookie(name: string, value: string) {
  if (typeof document === "undefined") return;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${value}; Path=/; Max-Age=${CONSENT_COOKIE_MAX_AGE}; SameSite=Lax${secure}`;
}

export function ConsentBanner() {
  // start hidden; show only if we've mounted *and* determined consent is missing
  const [state, setState] = useState<ConsentState>(DEFAULT_CONSENT);
  const [expanded, setExpanded] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const existing = parseConsent(readCookie(CONSENT_COOKIE));
    if (isStale(existing)) {
      setVisible(true);
    } else if (existing) {
      setState(existing);
    }
  }, []);

  function save(next: ConsentState) {
    const payload: ConsentState = {
      ...next,
      version: CONSENT_VERSION,
      decidedAt: Date.now(),
      essential: true,
    };
    writeCookie(CONSENT_COOKIE, serializeConsent(payload));
    setState(payload);
    setVisible(false);
    setExpanded(false);
    // broadcast so other listeners (settings page, etc) can react
    try {
      window.dispatchEvent(
        new CustomEvent("vainie:consent", { detail: payload }),
      );
    } catch {
      /* ignore */
    }
  }

  function acceptAll() {
    save({
      ...state,
      functional: true,
      aiTraining: true,
      version: CONSENT_VERSION,
      decidedAt: Date.now(),
      essential: true,
    });
  }

  function rejectOptional() {
    save({
      ...state,
      functional: false,
      aiTraining: false,
      version: CONSENT_VERSION,
      decidedAt: Date.now(),
      essential: true,
    });
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="consent-title"
      className="fixed inset-x-3 bottom-3 md:inset-x-auto md:right-4 md:bottom-4 md:max-w-md z-[150] animate-fade-up"
    >
      <div className="border border-default rounded-xl bg-app shadow-xl backdrop-blur-sm p-5 md:p-6">
        <h2
          id="consent-title"
          className="text-base md:text-lg font-semibold tracking-tight"
        >
          cookies &amp; data
        </h2>
        <p className="text-sm text-muted mt-2 leading-relaxed">
          this site uses essential cookies to work (login, csrf, this banner).
          everything else is opt-in. no ads, no third-party trackers.
        </p>

        {expanded ? (
          <div className="mt-4 space-y-3">
            <ToggleRow
              label="essential"
              description="session, csrf, consent memory. required."
              checked
              disabled
              onChange={() => {}}
            />
            <ToggleRow
              label="functional"
              description="theme preference (light/dark)."
              checked={state.functional}
              onChange={(v) => setState({ ...state, functional: v })}
            />
            <ToggleRow
              label="ai training (comments)"
              description="lets comments you post in the future be used to improve the writing assistant. off by default. changeable per-comment too."
              checked={state.aiTraining}
              onChange={(v) => setState({ ...state, aiTraining: v })}
            />

            <div className="flex flex-wrap gap-2 pt-2">
              <button
                type="button"
                onClick={() =>
                  save({
                    ...state,
                    version: CONSENT_VERSION,
                    decidedAt: Date.now(),
                    essential: true,
                  })
                }
                className="btn-primary !h-9 !px-4 !text-sm flex-1"
              >
                save my choices
              </button>
              <button
                type="button"
                onClick={() => setExpanded(false)}
                className="btn-ghost !h-9 !px-4 !text-sm"
              >
                back
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-[11px] text-subtle mt-3">
              read the full{" "}
              <Link
                href="/privacy"
                className="link-accent"
                onClick={() => setVisible(false)}
              >
                privacy policy
              </Link>
              .
            </p>

            <div className="flex flex-wrap gap-2 mt-5">
              <button
                type="button"
                onClick={acceptAll}
                className="btn-primary !h-9 !px-4 !text-sm flex-1"
              >
                accept all
              </button>
              <button
                type="button"
                onClick={rejectOptional}
                className="btn-ghost !h-9 !px-4 !text-sm flex-1"
              >
                reject optional
              </button>
            </div>

            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="mt-3 text-[12px] font-mono text-subtle hover:text-[rgb(var(--fg))] underline underline-offset-2"
            >
              customize →
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
  disabled = false,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label
      className={`flex items-start gap-3 p-3 rounded-lg border border-default ${
        disabled ? "bg-surface/40 opacity-80" : "bg-surface/60 cursor-pointer"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 accent-[rgb(var(--accent-light))] shrink-0"
      />
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-[12px] text-muted leading-snug mt-0.5">
          {description}
        </p>
      </div>
    </label>
  );
}
