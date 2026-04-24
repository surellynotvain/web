import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, verifyCsrfToken } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
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

  const allowAiTraining =
    typeof body?.allowAiTraining === "boolean"
      ? body.allowAiTraining
      : undefined;

  if (allowAiTraining === undefined) {
    return NextResponse.json({ error: "nothing to update" }, { status: 400 });
  }

  await db
    .update(users)
    .set({ allowAiTraining })
    .where(eq(users.id, user.id));

  return NextResponse.json({ ok: true });
}
