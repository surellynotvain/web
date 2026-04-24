import "server-only";

// Thin OpenRouter client. Docs: https://openrouter.ai/docs
// Reads OPENROUTER_API (legacy name used in .env.local) or OPENROUTER_API_KEY.
//
// Supports automatic fallback: if a model returns 429 (rate-limited) or
// 402/503 (provider capacity), the client tries the next model in the list
// configured via OPENROUTER_FALLBACK_MODELS (comma-separated).

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type ChatOptions = {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
};

export type ChatResult = {
  text: string;
  /** which model actually answered (after any fallback) */
  model: string;
  /** models that were tried but failed, and why */
  attempts: Array<{ model: string; status?: number; error: string }>;
};

function readApiKey(): string | null {
  return (
    process.env.OPENROUTER_API_KEY ??
    process.env.OPENROUTER_API ??
    null
  );
}

function readDefaultModel(): string {
  return (
    process.env.OPENROUTER_DEFAULT_MODEL ??
    "cognitivecomputations/dolphin-mistral-24b-venice-edition:free"
  );
}

function readFallbackModels(): string[] {
  // support both individual env vars (your naming) and a comma-separated
  // overflow list. order: SECONDARY → BACKUP → FALLBACK_MODELS[...]
  const out: string[] = [];
  const secondary = process.env.OPENROUTER_SECONDARY_MODEL?.trim();
  const backup = process.env.OPENROUTER_BACKUP_MODEL?.trim();
  if (secondary) out.push(secondary);
  if (backup) out.push(backup);
  const overflow = (process.env.OPENROUTER_FALLBACK_MODELS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  out.push(...overflow);
  return out;
}

/**
 * Build the ordered list of candidate models:
 *   1. explicit `opts.model` (if provided)
 *   2. OPENROUTER_DEFAULT_MODEL
 *   3. each of OPENROUTER_FALLBACK_MODELS in order
 * Duplicates are removed while preserving first-seen order.
 */
function buildModelChain(explicit?: string): string[] {
  const raw = [
    ...(explicit ? [explicit] : []),
    readDefaultModel(),
    ...readFallbackModels(),
  ];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of raw) {
    if (!m || seen.has(m)) continue;
    seen.add(m);
    out.push(m);
  }
  return out;
}

/** statuses that should trigger a fallback to the next model.
 *  - 402: payment required / model requires credits
 *  - 404: model not found / provider dropped support
 *  - 429: rate limited
 *  - 503: provider capacity / temporary outage
 */
const RETRYABLE_STATUSES = new Set([402, 404, 429, 503]);

export function isOpenRouterConfigured(): boolean {
  return Boolean(readApiKey());
}

export class OpenRouterError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly attempts?: ChatResult["attempts"],
  ) {
    super(message);
    this.name = "OpenRouterError";
  }
}

async function callOnce(
  key: string,
  model: string,
  messages: ChatMessage[],
  opts: ChatOptions,
): Promise<{ ok: true; text: string } | { ok: false; status?: number; error: string }> {
  let res: Response;
  try {
    res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://vainie.pl",
        "X-Title": "vainie.pl",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: opts.temperature ?? 0.4,
        max_tokens: opts.maxTokens ?? 1024,
      }),
      signal: opts.signal ?? AbortSignal.timeout(45_000),
      cache: "no-store",
    });
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "network error",
    };
  }

  if (!res.ok) {
    let detail = "";
    try {
      const body = await res.json();
      detail = body?.error?.message ?? body?.error ?? "";
    } catch {
      /* ignore */
    }
    return {
      ok: false,
      status: res.status,
      error: `${res.status} ${res.statusText}${detail ? ` — ${detail}` : ""}`,
    };
  }

  try {
    const body = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = body.choices?.[0]?.message?.content?.trim();
    if (!text) return { ok: false, error: "empty response" };
    return { ok: true, text };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "bad json",
    };
  }
}

/**
 * Send a chat completion to OpenRouter, falling back through the configured
 * model chain on retryable errors (429 / 402 / 503).
 *
 * Returns the text plus metadata about which model was used.
 * Throws OpenRouterError only if *every* candidate model fails.
 */
export async function chatCompletionWithFallback(
  messages: ChatMessage[],
  opts: ChatOptions = {},
): Promise<ChatResult> {
  const key = readApiKey();
  if (!key) throw new OpenRouterError("OPENROUTER_API key not configured");

  const chain = buildModelChain(opts.model);
  if (chain.length === 0) {
    throw new OpenRouterError("no models configured");
  }

  const attempts: ChatResult["attempts"] = [];

  for (const model of chain) {
    const result = await callOnce(key, model, messages, opts);

    if (result.ok) {
      return { text: result.text, model, attempts };
    }

    attempts.push({
      model,
      status: result.status,
      error: result.error,
    });

    // only fall through to next model on retryable statuses
    if (result.status === undefined || !RETRYABLE_STATUSES.has(result.status)) {
      // non-retryable error (400 bad request, 401 auth, etc) → stop here
      throw new OpenRouterError(
        `openrouter (${model}): ${result.error}`,
        result.status,
        attempts,
      );
    }
    // else: log and try next model
    console.warn(
      `[openrouter] ${model} returned ${result.status} — falling back`,
    );
  }

  // every model 429/503/402'd
  const summary = attempts
    .map((a) => `${a.model}:${a.status ?? "net"}`)
    .join(", ");
  throw new OpenRouterError(
    `all models rate-limited or unavailable (${summary}). try again later.`,
    429,
    attempts,
  );
}

/**
 * Convenience single-model call (no fallback). Kept for compatibility with
 * any callers that want strict behavior.
 */
export async function chatCompletion(
  messages: ChatMessage[],
  opts: ChatOptions = {},
): Promise<string> {
  const { text } = await chatCompletionWithFallback(messages, opts);
  return text;
}
