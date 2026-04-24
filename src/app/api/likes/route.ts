import { NextRequest, NextResponse } from "next/server";
import { toggleLike } from "@/lib/blog";
import {
  getCurrentUser,
  getOrCreateCookieId,
  verifyCsrfToken,
  getClientIp,
} from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { hashIp } from "@/lib/crypto";
import { db } from "@/lib/db";
import { posts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const ip = await getClientIp();
  const rl = rateLimit({
    key: `like:${hashIp(ip) ?? "anon"}`,
    limit: 60,
    windowMs: 60_000,
  });
  if (!rl.ok) return NextResponse.json({ error: "slow down" }, { status: 429 });

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  const { postSlug, csrf } = body ?? {};
  if (!(await verifyCsrfToken(csrf))) {
    return NextResponse.json({ error: "bad csrf token" }, { status: 403 });
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
  const cookieId = user ? null : await getOrCreateCookieId();

  const res = await toggleLike({
    postId: post.id,
    userId: user?.id ?? null,
    cookieId,
  });
  return NextResponse.json({ ok: true, ...res });
}
