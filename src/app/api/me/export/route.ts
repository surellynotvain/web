import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { comments, likes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

// GET /api/me/export
// Returns a JSON document with everything linked to the current user.
// Excludes hashed IPs (they're a security artifact, not user-facing data)
// and session tokens.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const [userComments, userLikes] = await Promise.all([
    db
      .select({
        id: comments.id,
        postId: comments.postId,
        content: comments.content,
        hidden: comments.hidden,
        allowAiTraining: comments.allowAiTraining,
        createdAt: comments.createdAt,
      })
      .from(comments)
      .where(eq(comments.userId, user.id)),
    db
      .select({
        id: likes.id,
        postId: likes.postId,
        createdAt: likes.createdAt,
      })
      .from(likes)
      .where(eq(likes.userId, user.id)),
  ]);

  const payload = {
    exportedAt: new Date().toISOString(),
    site: "vainie.pl",
    account: {
      id: user.id,
      username: user.username,
      email: user.email ?? null,
      oauthProvider: user.oauthProvider ?? null,
      role: user.role,
      allowAiTraining: user.allowAiTraining ?? false,
      createdAt:
        user.createdAt instanceof Date
          ? user.createdAt.toISOString()
          : String(user.createdAt),
    },
    comments: userComments.map((c) => ({
      ...c,
      createdAt:
        c.createdAt instanceof Date ? c.createdAt.toISOString() : String(c.createdAt),
    })),
    likes: userLikes.map((l) => ({
      ...l,
      createdAt:
        l.createdAt instanceof Date ? l.createdAt.toISOString() : String(l.createdAt),
    })),
    _note:
      "hashed IPs, password hash, and session tokens are intentionally excluded.",
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="vainie-export-${user.username}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
