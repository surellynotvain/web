import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, verifyCsrfToken, getClientIp } from "@/lib/auth";
import { createPost } from "@/lib/blog";
import { rateLimit } from "@/lib/rate-limit";
import { hashIp } from "@/lib/crypto";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const ip = await getClientIp();
  const rl = rateLimit({
    key: `post-create:${hashIp(ip) ?? "anon"}`,
    limit: 30,
    windowMs: 60 * 60 * 1000,
  });
  if (!rl.ok) return NextResponse.json({ error: "slow down" }, { status: 429 });

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const { title, excerpt, content, coverUrl, publish, csrf } = body ?? {};
  if (!(await verifyCsrfToken(csrf))) {
    return NextResponse.json({ error: "bad csrf token" }, { status: 403 });
  }
  if (typeof title !== "string" || typeof content !== "string") {
    return NextResponse.json({ error: "title + content required" }, { status: 400 });
  }

  try {
    const { id, slug } = await createPost({
      title,
      excerpt: typeof excerpt === "string" ? excerpt : null,
      content,
      coverUrl: typeof coverUrl === "string" ? coverUrl : null,
      authorId: admin.id,
      publish: Boolean(publish),
    });
    return NextResponse.json({ ok: true, id, slug });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "failed" },
      { status: 400 },
    );
  }
}
