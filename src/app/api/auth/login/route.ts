import { NextRequest, NextResponse } from "next/server";
import {
  authenticateByPassword,
  createSession,
  setSessionCookie,
  verifyCsrfToken,
} from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { headers } from "next/headers";
import { hashIp } from "@/lib/crypto";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "unknown";
  const key = `login:${hashIp(ip)}`;
  const rl = rateLimit({ key, limit: 8, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json({ error: "slow down" }, { status: 429 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const { usernameOrEmail, password, csrf } = body ?? {};
  if (typeof usernameOrEmail !== "string" || typeof password !== "string") {
    return NextResponse.json({ error: "bad input" }, { status: 400 });
  }
  if (!(await verifyCsrfToken(csrf))) {
    return NextResponse.json({ error: "bad csrf token" }, { status: 403 });
  }

  const user = await authenticateByPassword(usernameOrEmail, password);
  if (!user) {
    return NextResponse.json(
      { error: "invalid credentials" },
      { status: 401 },
    );
  }

  const sid = await createSession(user.id);
  await setSessionCookie(sid);

  return NextResponse.json({
    ok: true,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
    },
  });
}
