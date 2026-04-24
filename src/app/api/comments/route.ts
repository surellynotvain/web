import { NextRequest, NextResponse } from "next/server";
import { addComment } from "@/lib/blog";
import {
  getCurrentUser,
  verifyCsrfToken,
  getClientIp,
  requireAdmin,
} from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { hashIp } from "@/lib/crypto";
import { db } from "@/lib/db";
import { posts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { hideComment } from "@/lib/blog";

export const runtime = "nodejs";

// POST /api/comments  — add a comment
export async function POST(req: NextRequest) {
  const ip = await getClientIp();
  const ipH = hashIp(ip);
  const rl = rateLimit({
    key: `comment:${ipH ?? "anon"}`,
    limit: 6,
    windowMs: 10 * 60 * 1000,
  });
  if (!rl.ok) return NextResponse.json({ error: "slow down" }, { status: 429 });

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const { postSlug, content, authorName, allowAiTraining, csrf } = body ?? {};
  if (!(await verifyCsrfToken(csrf))) {
    return NextResponse.json({ error: "bad csrf token" }, { status: 403 });
  }
  if (typeof postSlug !== "string" || typeof content !== "string") {
    return NextResponse.json({ error: "bad input" }, { status: 400 });
  }
  if (content.trim().length < 1) {
    return NextResponse.json({ error: "empty comment" }, { status: 400 });
  }

  const [post] = await db
    .select({ id: posts.id, published: posts.published })
    .from(posts)
    .where(eq(posts.slug, postSlug))
    .limit(1);
  if (!post || !post.published) {
    return NextResponse.json({ error: "post not found" }, { status: 404 });
  }

  const user = await getCurrentUser();

  try {
    const id = await addComment({
      postId: post.id,
      userId: user?.id ?? null,
      authorName: typeof authorName === "string" ? authorName : null,
      content,
      ipHash: ipH,
      allowAiTraining: Boolean(allowAiTraining),
    });
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "failed" },
      { status: 400 },
    );
  }
}

// DELETE /api/comments?id=... (hide, admin only)
export async function DELETE(req: NextRequest) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let csrf: unknown;
  try {
    const body = await req.json();
    csrf = body?.csrf;
  } catch {
    /* fall through to csrf check with empty */
  }
  if (!(await verifyCsrfToken(typeof csrf === "string" ? csrf : ""))) {
    return NextResponse.json({ error: "bad csrf token" }, { status: 403 });
  }

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });
  await hideComment(id);
  return NextResponse.json({ ok: true });
}
