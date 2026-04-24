import { NextRequest, NextResponse } from "next/server";
import { isPasswordLeaked } from "@/lib/password-check";
import { rateLimit } from "@/lib/rate-limit";
import { headers } from "next/headers";
import { hashIp } from "@/lib/crypto";

export const runtime = "nodejs";

// POST /api/auth/check-password  — quick bloom lookup (no password ever stored)
export async function POST(req: NextRequest) {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rl = rateLimit({
    key: `check-pw:${hashIp(ip)}`,
    limit: 60,
    windowMs: 60 * 1000,
  });
  if (!rl.ok) return NextResponse.json({ error: "slow down" }, { status: 429 });

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  const password = body?.password;
  if (typeof password !== "string" || password.length < 1) {
    return NextResponse.json({ leaked: false });
  }
  return NextResponse.json({ leaked: isPasswordLeaked(password) });
}
