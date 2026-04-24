// Centralized consent management.
// Stored in a single cookie (client-readable, small). For logged-in users,
// we also mirror their global AI-training opt-in into a DB column (see
// users.allowAiTraining) so server-side checks don't rely on a cookie that
// can be wiped or tampered with.

export type ConsentCategory = "essential" | "functional" | "aiTraining";

export type ConsentState = {
  version: number;       // bump when we add a new category
  decidedAt: number;     // epoch ms when the user last interacted with the banner
  essential: true;       // always true; here for documentation
  functional: boolean;   // e.g. theme cookie
  aiTraining: boolean;   // allow comments to feed the ai writing assistant
};

export const CONSENT_COOKIE = "vainie_consent";
export const CONSENT_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year
export const CONSENT_VERSION = 1;

export const DEFAULT_CONSENT: ConsentState = {
  version: CONSENT_VERSION,
  decidedAt: 0,
  essential: true,
  functional: false,
  aiTraining: false,
};

export function parseConsent(raw: string | undefined | null): ConsentState | null {
  if (!raw) return null;
  try {
    const decoded = decodeURIComponent(raw);
    const parsed = JSON.parse(decoded) as Partial<ConsentState>;
    if (typeof parsed?.version !== "number") return null;
    return {
      version: parsed.version,
      decidedAt: typeof parsed.decidedAt === "number" ? parsed.decidedAt : 0,
      essential: true,
      functional: Boolean(parsed.functional),
      aiTraining: Boolean(parsed.aiTraining),
    };
  } catch {
    return null;
  }
}

export function serializeConsent(c: ConsentState): string {
  return encodeURIComponent(
    JSON.stringify({
      version: c.version,
      decidedAt: c.decidedAt,
      functional: c.functional,
      aiTraining: c.aiTraining,
    }),
  );
}

export function isStale(c: ConsentState | null): boolean {
  if (!c) return true;
  return c.version < CONSENT_VERSION;
}
