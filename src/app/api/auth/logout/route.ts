import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { deleteSession, clearSessionCookie, SESSION_COOKIE } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST() {
  const c = await cookies();
  const sid = c.get(SESSION_COOKIE)?.value;
  if (sid) await deleteSession(sid);
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
