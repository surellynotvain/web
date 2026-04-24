import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import {
  getPostBySlug,
  listCommentsForPost,
  countCommentsForPost,
  hasLiked,
} from "@/lib/blog";
import {
  getCurrentUser,
  readCookieId,
  generateCsrfToken,
} from "@/lib/auth";
import { COMMENTS_PAGE_SIZE } from "@/lib/constants";
import { readingTime } from "@/lib/reading-time";
import { PostInteractions } from "@/components/post-interactions";
import { AdminPostControls } from "@/components/admin-post-controls";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const p = await getPostBySlug(slug);
  if (!p) return { title: "not found — vainie" };
  return {
    title: `${p.title} — vainie`,
    description: p.excerpt ?? undefined,
  };
}

function formatDate(d: Date | null): string {
  if (!d) return "";
  return d.toLocaleDateString("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function PostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) notFound();

  const [user, csrf, comments, commentTotal] = await Promise.all([
    getCurrentUser(),
    generateCsrfToken(),
    listCommentsForPost(post.id, { limit: COMMENTS_PAGE_SIZE, offset: 0 }),
    countCommentsForPost(post.id),
  ]);

  const cookieId = user ? null : await readCookieId();
  const liked = await hasLiked({
    postId: post.id,
    userId: user?.id ?? null,
    cookieId,
  });

  const rt = readingTime(post.content);

  return (
    <article className="container-tight py-12 md:py-24">
      <Link
        href="/blog"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-[rgb(var(--fg))] transition-colors mb-8 md:mb-10"
      >
        <span>←</span> all posts
      </Link>

      <div className="eyebrow mb-5">
        {post.publishedAt ? formatDate(post.publishedAt) : "draft"} · by{" "}
        {post.authorUsername} · {rt.minutes} min read
      </div>
      <h1 className="text-3xl md:text-6xl font-semibold tracking-tight leading-[1.05]">
        {post.title}
      </h1>
      {post.excerpt && (
        <p className="text-muted text-lg md:text-xl mt-4">{post.excerpt}</p>
      )}

      {user?.role === "admin" && (
        <AdminPostControls postId={post.id} postSlug={post.slug} csrf={csrf} />
      )}

      {post.coverUrl && (
        <div className="mt-10 border border-default rounded-xl overflow-hidden bg-surface">
          <Image
            src={post.coverUrl}
            alt={post.title}
            width={1600}
            height={900}
            sizes="(min-width: 768px) 720px, 100vw"
            className="w-full h-auto block"
            priority
          />
        </div>
      )}

      <div
        className="prose-post mt-10"
        dangerouslySetInnerHTML={{ __html: post.contentHtml }}
      />

      <PostInteractions
        postSlug={post.slug}
        postId={post.id}
        initialLikes={post.likeCount}
        initialLiked={liked}
        initialComments={comments}
        initialCommentTotal={commentTotal}
        user={user ? { id: user.id, username: user.username, role: user.role } : null}
        csrf={csrf}
      />
    </article>
  );
}
