import { NextRequest, NextResponse } from "next/server";
import {
  createUserWithPassword,
  createSession,
  setSessionCookie,
  verifyCsrfToken,
} from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { headers } from "next/headers";
import { hashIp } from "@/lib/crypto";
import { isPasswordLeaked } from "@/lib/password-check";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rl = rateLimit({
    key: `signup:${hashIp(ip)}`,
    limit: 5,
    windowMs: 60 * 60 * 1000,
  });
  if (!rl.ok) return NextResponse.json({ error: "slow down" }, { status: 429 });

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const { username, email, password, csrf } = body ?? {};
  if (typeof username !== "string" || typeof password !== "string") {
    return NextResponse.json({ error: "bad input" }, { status: 400 });
  }
  if (!(await verifyCsrfToken(csrf))) {
    return NextResponse.json({ error: "bad csrf token" }, { status: 403 });
  }

  // reject passwords from known breaches
  if (isPasswordLeaked(password)) {
    return NextResponse.json(
      {
        error:
          "that password appears in a known data breach. pick something unique.",
      },
      { status: 400 },
    );
  }

  try {
    const user = await createUserWithPassword({
      username,
      email: typeof email === "string" && email.trim() ? email.trim() : null,
      password,
    });
    const sid = await createSession(user.id);
    await setSessionCookie(sid);
    return NextResponse.json({
      ok: true,
      user: { id: user.id, username: user.username, role: user.role },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "signup failed";
    if (msg.includes("UNIQUE") || msg.includes("username")) {
      return NextResponse.json(
        { error: "username already taken" },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
