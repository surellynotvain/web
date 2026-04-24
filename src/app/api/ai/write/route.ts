import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, verifyCsrfToken, getClientIp } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { hashIp } from "@/lib/crypto";
import {
  chatCompletionWithFallback,
  isOpenRouterConfigured,
  OpenRouterError,
  type ChatResult,
} from "@/lib/openrouter";
import { clearPreferredModel } from "@/lib/openrouter-state";
import {
  AI_MAX_INPUT_CHARS,
  LENGTH_CHECK_MIN_INPUT,
  expectedLengthRatio,
  promptForAction,
  VAINIE_STYLE_GUIDE,
  type AiAction,
} from "@/lib/writing-style";

export const runtime = "nodejs";
export const maxDuration = 60;

const ALLOWED_ACTIONS: AiAction[] = [
  "grammar",
  "polish",
  "expand",
  "shorten",
  "rewrite",
];

/** cap on how many total attempts across all models per request */
const MAX_TOTAL_ATTEMPTS = 6;

export async function POST(req: NextRequest) {
  // admin only — this endpoint costs money to run
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!isOpenRouterConfigured()) {
    return NextResponse.json(
      { error: "openrouter not configured" },
      { status: 503 },
    );
  }

  // per-admin rate limit
  const ip = await getClientIp();
  const rl = rateLimit({
    key: `ai-write:${admin.id}:${hashIp(ip) ?? "anon"}`,
    limit: 20,
    windowMs: 10 * 60 * 1000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "rate limit: 20 requests / 10 min" },
      { status: 429 },
    );
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  if (!(await verifyCsrfToken(body?.csrf))) {
    return NextResponse.json({ error: "bad csrf token" }, { status: 403 });
  }

  const action = body?.action as unknown;
  const text = body?.text as unknown;
  const context = body?.context as unknown;

  if (
    typeof action !== "string" ||
    !ALLOWED_ACTIONS.includes(action as AiAction)
  ) {
    return NextResponse.json({ error: "bad action" }, { status: 400 });
  }
  if (typeof text !== "string") {
    return NextResponse.json({ error: "text required" }, { status: 400 });
  }

  const trimmed = text.trim();
  if (!trimmed) {
    return NextResponse.json({ error: "empty text" }, { status: 400 });
  }
  if (trimmed.length > AI_MAX_INPUT_CHARS) {
    return NextResponse.json(
      {
        error: `text too long (max ${AI_MAX_INPUT_CHARS} chars — got ${trimmed.length}). select a smaller range.`,
      },
      { status: 400 },
    );
  }

  const typedAction = action as AiAction;
  const userPrompt = promptForAction(
    typedAction,
    trimmed,
    typeof context === "string" ? context : undefined,
  );

  // size the output budget relative to input — free models are often capped
  // at low defaults and will truncate without enough room. rough rule:
  //   ~1 token per 3-4 chars → grant 3x the input tokens plus headroom.
  const approxInputTokens = Math.ceil(trimmed.length / 3);
  const dynamicMaxTokens = Math.min(
    8192,
    Math.max(1024, approxInputTokens * 3 + 512),
  );

  // track all attempts (including ones rejected for being truncated) so we
  // can surface them on final failure
  const allAttempts: ChatResult["attempts"] = [];
  let attemptsUsed = 0;

  // we may need to re-call chatCompletionWithFallback if the returned text
  // looks truncated. the fallback lib already moves past 429/404/etc; this
  // loop handles the "200 ok but garbage" case by nudging past the winning
  // model and trying the next one.
  const excludedModels = new Set<string>();

  while (attemptsUsed < MAX_TOTAL_ATTEMPTS) {
    attemptsUsed += 1;

    let result: ChatResult;
    try {
      result = await chatCompletionWithFallback(
        [
          { role: "system", content: VAINIE_STYLE_GUIDE },
          { role: "user", content: userPrompt },
        ],
        {
          temperature: 0.3,
          maxTokens: dynamicMaxTokens,
          // exclude models we've already seen return truncated garbage
          excludeModels: Array.from(excludedModels),
        },
      );
    } catch (err) {
      if (err instanceof OpenRouterError) {
        if (err.attempts) allAttempts.push(...err.attempts);
        return NextResponse.json(
          {
            error: err.message,
            attempts: allAttempts,
          },
          {
            status:
              err.status && err.status >= 400 && err.status < 600
                ? err.status
                : 502,
          },
        );
      }
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "ai call failed" },
        { status: 500 },
      );
    }

    allAttempts.push(...result.attempts);

    const cleaned = stripWrappingQuotesAndFences(result.text);

    // output sanity: catch obvious truncation / under-response
    if (looksTruncated(trimmed, cleaned, typedAction)) {
      console.warn(
        `[ai/write] ${result.model} returned truncated output (${cleaned.length} chars vs ${trimmed.length} input) — retrying with next model`,
      );
      allAttempts.push({
        model: result.model,
        error: `output looks truncated (${cleaned.length}/${trimmed.length} chars)`,
      });
      excludedModels.add(result.model);
      // this model was just "preferred"; reset the cache so next call starts fresh
      await clearPreferredModel().catch(() => {});
      continue;
    }

    return NextResponse.json({
      ok: true,
      text: cleaned,
      action,
      model: result.model,
      fallbackCount: allAttempts.length - 1, // minus the success itself
    });
  }

  // ran out of attempts
  return NextResponse.json(
    {
      error:
        "every model returned a truncated or unusable response. try again, or simplify your selection.",
      attempts: allAttempts,
    },
    { status: 502 },
  );
}

/**
 * Heuristic: has the model stopped early? Only applies to inputs long enough
 * for the signal to be meaningful; short inputs are too noisy.
 */
function looksTruncated(
  input: string,
  output: string,
  action: AiAction,
): boolean {
  if (input.length < LENGTH_CHECK_MIN_INPUT) return false;
  if (!output.trim()) return true;

  const ratio = output.length / input.length;
  const { min, max } = expectedLengthRatio(action);
  if (ratio < min || ratio > max) return true;

  // ends mid-sentence? looks for a closing punctuation or code fence within
  // the last 40 chars. false positives on lists without trailing period —
  // accept that risk; better to re-roll than ship a cliff-hanger.
  const tail = output.trimEnd().slice(-40);
  const endsOk =
    /[.!?)"\]`*_\-0-9]$|```\s*$/.test(tail) ||
    tail.endsWith(">") || // html/markdown
    tail.endsWith(":") ||
    tail.endsWith("—");
  if (!endsOk) return true;

  return false;
}

/**
 * Strip common LLM artifacts: wrapping triple-backtick fences or straight
 * quote wrappers around the entire reply. Preserves internal fences.
 */
function stripWrappingQuotesAndFences(s: string): string {
  let t = s.trim();
  // whole-thing fenced?
  const fenceMatch = t.match(/^```[a-zA-Z]*\n([\s\S]*?)\n```$/);
  if (fenceMatch) t = fenceMatch[1].trim();
  // wrapping straight quotes
  if (t.startsWith('"') && t.endsWith('"') && t.length > 1) {
    const inner = t.slice(1, -1);
    if (!inner.includes('"')) t = inner;
  }
  return t;
}
