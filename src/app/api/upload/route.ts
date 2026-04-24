import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, verifyCsrfToken, getClientIp } from "@/lib/auth";
import { saveUploadedImage } from "@/lib/uploads";
import { rateLimit } from "@/lib/rate-limit";
import { hashIp } from "@/lib/crypto";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const ip = await getClientIp();
  const rl = rateLimit({
    key: `upload:${hashIp(ip) ?? "anon"}`,
    limit: 30,
    windowMs: 10 * 60 * 1000,
  });
  if (!rl.ok) return NextResponse.json({ error: "slow down" }, { status: 429 });

  const form = await req.formData();
  const file = form.get("file");
  const csrf = form.get("csrf");
  if (typeof csrf !== "string" || !(await verifyCsrfToken(csrf))) {
    return NextResponse.json({ error: "bad csrf token" }, { status: 403 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "no file" }, { status: 400 });
  }
  try {
    const result = await saveUploadedImage(file);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "upload failed" },
      { status: 400 },
    );
  }
}
