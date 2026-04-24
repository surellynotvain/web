import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, verifyCsrfToken } from "@/lib/auth";
import { updatePost, deletePost, getPostByIdForEdit } from "@/lib/blog";

export const runtime = "nodejs";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    await requireAdmin();
  } catch {
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

  try {
    const { slug } = await updatePost(id, {
      title: typeof body.title === "string" ? body.title : undefined,
      excerpt: body.excerpt,
      content: typeof body.content === "string" ? body.content : undefined,
      coverUrl: body.coverUrl,
      publish: typeof body.publish === "boolean" ? body.publish : undefined,
    });
    return NextResponse.json({ ok: true, slug });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "failed" },
      { status: 400 },
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
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
    // allow empty body, fall through to csrf check
  }
  if (!(await verifyCsrfToken(typeof csrf === "string" ? csrf : ""))) {
    return NextResponse.json({ error: "bad csrf token" }, { status: 403 });
  }

  const post = await getPostByIdForEdit(id);
  if (!post) return NextResponse.json({ error: "not found" }, { status: 404 });
  await deletePost(id);
  return NextResponse.json({ ok: true });
}
