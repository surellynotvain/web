import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, verifyCsrfToken, getClientIp } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { hashIp } from "@/lib/crypto";
import {
  chatCompletionWithFallback,
  isOpenRouterConfigured,
  OpenRouterError,
} from "@/lib/openrouter";
import {
  AI_MAX_INPUT_CHARS,
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

  const userPrompt = promptForAction(
    action as AiAction,
    trimmed,
    typeof context === "string" ? context : undefined,
  );

  try {
    const result = await chatCompletionWithFallback(
      [
        { role: "system", content: VAINIE_STYLE_GUIDE },
        { role: "user", content: userPrompt },
      ],
      { temperature: 0.3 },
    );
    return NextResponse.json({
      ok: true,
      text: stripWrappingQuotesAndFences(result.text),
      action,
      model: result.model,
      // how many fallbacks we went through (useful to surface in UI)
      fallbackCount: result.attempts.length,
    });
  } catch (err) {
    if (err instanceof OpenRouterError) {
      return NextResponse.json(
        {
          error: err.message,
          attempts: err.attempts ?? [],
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
