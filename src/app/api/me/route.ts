import { NextRequest, NextResponse } from "next/server";
import {
  getCurrentUser,
  verifyCsrfToken,
  clearSessionCookie,
} from "@/lib/auth";
import { db } from "@/lib/db";
import { users, sessions, comments, likes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ user: null });
  return NextResponse.json({
    user: { id: user.id, username: user.username, role: user.role },
  });
}

// DELETE /api/me — remove the current user's account entirely.
// Cascades: sessions (ON DELETE CASCADE), comments (ON DELETE SET NULL on
// user_id, but we want them gone — we delete them explicitly first), likes.
// Admin posts are left with a now-null or still-present authorId; if the
// user is an admin, their posts keep their content but lose the author link.
// This is safe because the delete is admin-initiated.
export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let csrf: unknown;
  try {
    const body = await req.json();
    csrf = body?.csrf;
  } catch {
    /* fall through */
  }
  if (!(await verifyCsrfToken(typeof csrf === "string" ? csrf : ""))) {
    return NextResponse.json({ error: "bad csrf token" }, { status: 403 });
  }

  // refuse to delete the last admin — would lock the site out of its own dashboard
  if (user.role === "admin") {
    const allAdmins = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.role, "admin"));
    if (allAdmins.length <= 1) {
      return NextResponse.json(
        { error: "cannot delete the last admin account" },
        { status: 400 },
      );
    }
  }

  // sessions cascade via FK, but delete explicitly so nothing lingers
  await db.delete(sessions).where(eq(sessions.userId, user.id));
  // explicit comment + like deletion (we want the content gone, not orphaned)
  await db.delete(comments).where(eq(comments.userId, user.id));
  await db.delete(likes).where(eq(likes.userId, user.id));
  // finally, the user row itself
  await db.delete(users).where(eq(users.id, user.id));

  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
