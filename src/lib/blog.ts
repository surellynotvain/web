import "server-only";
import { db, sql } from "@/lib/db";
import { posts, comments, likes, users } from "@/lib/db/schema";
import { and, desc, eq, isNull } from "drizzle-orm";
import { newId } from "@/lib/crypto";
import { renderMarkdown, autoRelNoopener } from "@/lib/markdown";
import {
  BLOG_PAGE_SIZE,
  COMMENT_CHAR_LIMIT,
  COMMENT_NAME_LIMIT,
  COMMENTS_PAGE_SIZE,
} from "@/lib/constants";

export type PostListItem = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  coverUrl: string | null;
  publishedAt: Date | null;
  authorUsername: string;
  commentCount: number;
  likeCount: number;
};

export type PostFull = PostListItem & {
  content: string;       // raw markdown
  contentHtml: string;   // sanitized html
};

// ---------- slugs ----------

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

async function uniqueSlug(base: string): Promise<string> {
  let slug = base || newId(8);
  let i = 1;
  while (true) {
    const [row] = await db
      .select({ id: posts.id })
      .from(posts)
      .where(eq(posts.slug, slug))
      .limit(1);
    if (!row) return slug;
    i += 1;
    slug = `${base}-${i}`;
    if (i > 1000) return `${base}-${newId(6)}`;
  }
}

// ---------- count helpers ----------

async function countsForPost(postId: string) {
  const [c] = await db
    .select({ n: sql<number>`count(*)` })
    .from(comments)
    .where(and(eq(comments.postId, postId), eq(comments.hidden, false)));
  const [l] = await db
    .select({ n: sql<number>`count(*)` })
    .from(likes)
    .where(eq(likes.postId, postId));
  return { comments: c?.n ?? 0, likes: l?.n ?? 0 };
}

// ---------- list ----------

export async function listPublishedPosts(
  opts: { limit?: number; offset?: number } = {},
): Promise<PostListItem[]> {
  const limit = Math.min(opts.limit ?? BLOG_PAGE_SIZE, 100);
  const offset = opts.offset ?? 0;

  const rows = await db
    .select({
      id: posts.id,
      slug: posts.slug,
      title: posts.title,
      excerpt: posts.excerpt,
      coverUrl: posts.coverUrl,
      publishedAt: posts.publishedAt,
      authorUsername: users.username,
    })
    .from(posts)
    .innerJoin(users, eq(users.id, posts.authorId))
    .where(eq(posts.published, true))
    .orderBy(desc(posts.publishedAt))
    .limit(limit)
    .offset(offset);

  const withCounts = await Promise.all(
    rows.map(async (r) => {
      const c = await countsForPost(r.id);
      return {
        ...r,
        commentCount: c.comments,
        likeCount: c.likes,
      };
    }),
  );
  return withCounts;
}

export async function countPublishedPosts(): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(posts)
    .where(eq(posts.published, true));
  return Number(row?.n ?? 0);
}

export async function listAllPostsForAdmin(
  opts: { limit?: number; offset?: number } = {},
): Promise<PostListItem[]> {
  const limit = Math.min(opts.limit ?? 30, 200);
  const offset = opts.offset ?? 0;
  const rows = await db
    .select({
      id: posts.id,
      slug: posts.slug,
      title: posts.title,
      excerpt: posts.excerpt,
      coverUrl: posts.coverUrl,
      publishedAt: posts.publishedAt,
      published: posts.published,
      authorUsername: users.username,
    })
    .from(posts)
    .innerJoin(users, eq(users.id, posts.authorId))
    .orderBy(desc(posts.createdAt))
    .limit(limit)
    .offset(offset);

  return Promise.all(
    rows.map(async (r) => {
      const c = await countsForPost(r.id);
      return {
        id: r.id,
        slug: r.slug,
        title: r.title,
        excerpt: r.excerpt,
        coverUrl: r.coverUrl,
        publishedAt: r.published ? r.publishedAt : null,
        authorUsername: r.authorUsername,
        commentCount: c.comments,
        likeCount: c.likes,
      };
    }),
  );
}

export async function countAllPostsForAdmin(): Promise<number> {
  const [row] = await db.select({ n: sql<number>`count(*)` }).from(posts);
  return Number(row?.n ?? 0);
}

// ---------- get ----------

export async function getPostBySlug(slug: string): Promise<PostFull | null> {
  const [row] = await db
    .select({
      id: posts.id,
      slug: posts.slug,
      title: posts.title,
      excerpt: posts.excerpt,
      content: posts.content,
      coverUrl: posts.coverUrl,
      publishedAt: posts.publishedAt,
      published: posts.published,
      authorUsername: users.username,
    })
    .from(posts)
    .innerJoin(users, eq(users.id, posts.authorId))
    .where(eq(posts.slug, slug))
    .limit(1);

  if (!row || !row.published) return null;

  const c = await countsForPost(row.id);
  const html = autoRelNoopener(renderMarkdown(row.content));

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    content: row.content,
    contentHtml: html,
    coverUrl: row.coverUrl,
    publishedAt: row.publishedAt,
    authorUsername: row.authorUsername,
    commentCount: c.comments,
    likeCount: c.likes,
  };
}

export async function getPostByIdForEdit(id: string) {
  const [row] = await db
    .select()
    .from(posts)
    .where(eq(posts.id, id))
    .limit(1);
  return row ?? null;
}

// ---------- create / update ----------

export async function createPost(input: {
  title: string;
  excerpt?: string | null;
  content: string;
  coverUrl?: string | null;
  authorId: string;
  publish: boolean;
}) {
  const title = input.title.trim();
  if (!title) throw new Error("title required");
  if (!input.content.trim()) throw new Error("content required");

  const slug = await uniqueSlug(slugify(title));
  const id = newId();
  const now = new Date();

  await db.insert(posts).values({
    id,
    slug,
    title,
    excerpt: input.excerpt?.trim() || null,
    content: input.content,
    coverUrl: input.coverUrl || null,
    authorId: input.authorId,
    published: input.publish,
    publishedAt: input.publish ? now : null,
    createdAt: now,
    updatedAt: now,
  });

  return { id, slug };
}

export async function updatePost(
  id: string,
  patch: {
    title?: string;
    excerpt?: string | null;
    content?: string;
    coverUrl?: string | null;
    publish?: boolean;
  },
) {
  const existing = await getPostByIdForEdit(id);
  if (!existing) throw new Error("post not found");

  const title = patch.title?.trim() ?? existing.title;
  let slug = existing.slug;
  if (patch.title && patch.title.trim() !== existing.title) {
    slug = await uniqueSlug(slugify(title));
  }

  const publishing =
    patch.publish !== undefined && patch.publish && !existing.published;

  await db
    .update(posts)
    .set({
      title,
      slug,
      excerpt: patch.excerpt !== undefined ? patch.excerpt?.trim() || null : existing.excerpt,
      content: patch.content ?? existing.content,
      coverUrl: patch.coverUrl !== undefined ? patch.coverUrl || null : existing.coverUrl,
      published: patch.publish ?? existing.published,
      publishedAt:
        publishing
          ? new Date()
          : patch.publish === false
            ? null
            : existing.publishedAt,
      updatedAt: new Date(),
    })
    .where(eq(posts.id, id));

  return { slug };
}

export async function deletePost(id: string) {
  await db.delete(posts).where(eq(posts.id, id));
}

// ---------- comments ----------

export type CommentWithAuthor = {
  id: string;
  content: string;
  createdAt: Date;
  authorName: string; // resolved
  isAdmin: boolean;
  isAnon: boolean;
};

const commentTextLimit = COMMENT_CHAR_LIMIT;

export async function listCommentsForPost(
  postId: string,
  opts: { limit?: number; offset?: number } = {},
): Promise<CommentWithAuthor[]> {
  const limit = Math.min(opts.limit ?? COMMENTS_PAGE_SIZE, 200);
  const offset = opts.offset ?? 0;
  const rows = await db
    .select({
      id: comments.id,
      content: comments.content,
      createdAt: comments.createdAt,
      userId: comments.userId,
      authorNameAnon: comments.authorName,
      username: users.username,
      role: users.role,
    })
    .from(comments)
    .leftJoin(users, eq(users.id, comments.userId))
    .where(and(eq(comments.postId, postId), eq(comments.hidden, false)))
    .orderBy(desc(comments.createdAt))
    .limit(limit)
    .offset(offset);

  return rows.map((r) => ({
    id: r.id,
    content: r.content,
    createdAt: r.createdAt,
    authorName:
      r.username ?? (r.authorNameAnon?.trim() || "anonymous"),
    isAdmin: r.role === "admin",
    isAnon: !r.username,
  }));
}

export async function countCommentsForPost(postId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(comments)
    .where(and(eq(comments.postId, postId), eq(comments.hidden, false)));
  return Number(row?.n ?? 0);
}

export async function addComment(input: {
  postId: string;
  userId: string | null;
  authorName: string | null;
  content: string;
  ipHash: string | null;
  allowAiTraining: boolean;
}) {
  const content = input.content.trim();
  if (!content) throw new Error("comment empty");
  if (content.length > commentTextLimit) {
    throw new Error(`comment too long (max ${commentTextLimit})`);
  }
  let name = input.authorName?.trim() ?? null;
  if (name) name = name.slice(0, COMMENT_NAME_LIMIT);

  const id = newId();
  await db.insert(comments).values({
    id,
    postId: input.postId,
    userId: input.userId,
    authorName: input.userId ? null : name,
    content,
    ipHash: input.ipHash,
    allowAiTraining: Boolean(input.allowAiTraining),
  });
  return id;
}

export async function hideComment(id: string) {
  await db.update(comments).set({ hidden: true }).where(eq(comments.id, id));
}

// ---------- likes ----------

export async function toggleLike(input: {
  postId: string;
  userId: string | null;
  cookieId: string | null;
}): Promise<{ liked: boolean; count: number }> {
  if (!input.userId && !input.cookieId) {
    throw new Error("need an identity to like");
  }

  // find existing
  const existing = input.userId
    ? await db
        .select()
        .from(likes)
        .where(and(eq(likes.postId, input.postId), eq(likes.userId, input.userId)))
        .limit(1)
    : await db
        .select()
        .from(likes)
        .where(
          and(
            eq(likes.postId, input.postId),
            eq(likes.cookieId, input.cookieId!),
            isNull(likes.userId),
          ),
        )
        .limit(1);

  if (existing[0]) {
    await db.delete(likes).where(eq(likes.id, existing[0].id));
  } else {
    await db.insert(likes).values({
      id: newId(),
      postId: input.postId,
      userId: input.userId,
      cookieId: input.userId ? null : input.cookieId,
    });
  }

  const [{ n } = { n: 0 }] = await db
    .select({ n: sql<number>`count(*)` })
    .from(likes)
    .where(eq(likes.postId, input.postId));

  return { liked: !existing[0], count: Number(n ?? 0) };
}

export async function hasLiked(input: {
  postId: string;
  userId: string | null;
  cookieId: string | null;
}): Promise<boolean> {
  if (!input.userId && !input.cookieId) return false;
  const rows = input.userId
    ? await db
        .select({ id: likes.id })
        .from(likes)
        .where(and(eq(likes.postId, input.postId), eq(likes.userId, input.userId)))
        .limit(1)
    : await db
        .select({ id: likes.id })
        .from(likes)
        .where(
          and(
            eq(likes.postId, input.postId),
            eq(likes.cookieId, input.cookieId!),
            isNull(likes.userId),
          ),
        )
        .limit(1);
  return rows.length > 0;
}
