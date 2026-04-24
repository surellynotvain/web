import { NextRequest, NextResponse } from "next/server";
import { listCommentsForPost, countCommentsForPost } from "@/lib/blog";
import { db } from "@/lib/db";
import { posts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { COMMENTS_PAGE_SIZE } from "@/lib/constants";

export const runtime = "nodejs";

// GET /api/comments/list?postId=<id>&offset=<n>
// returns the next page of non-hidden comments for a published post.
export async function GET(req: NextRequest) {
  const postId = req.nextUrl.searchParams.get("postId");
  const offsetRaw = req.nextUrl.searchParams.get("offset") ?? "0";
  const offset = Math.max(0, Math.min(parseInt(offsetRaw, 10) || 0, 10_000));

  if (!postId) {
    return NextResponse.json({ error: "missing postId" }, { status: 400 });
  }

  const [post] = await db
    .select({ id: posts.id, published: posts.published })
    .from(posts)
    .where(eq(posts.id, postId))
    .limit(1);
  if (!post || !post.published) {
    return NextResponse.json({ error: "post not found" }, { status: 404 });
  }

  const [items, total] = await Promise.all([
    listCommentsForPost(postId, { limit: COMMENTS_PAGE_SIZE, offset }),
    countCommentsForPost(postId),
  ]);

  return NextResponse.json({
    items: items.map((c) => ({
      ...c,
      createdAt: c.createdAt.toISOString(),
    })),
    total,
    nextOffset: offset + items.length,
    hasMore: offset + items.length < total,
  });
}
