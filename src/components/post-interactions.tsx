"use client";

import { useState, useTransition } from "react";
import type { CommentWithAuthor } from "@/lib/blog";
import { useToast } from "@/components/toast";
import { useConfirm } from "@/components/confirm";
import { COMMENT_CHAR_LIMIT, COMMENT_NAME_LIMIT } from "@/lib/constants";

type Props = {
  postSlug: string;
  postId: string;
  initialLikes: number;
  initialLiked: boolean;
  initialComments: CommentWithAuthor[];
  initialCommentTotal: number;
  user: { id: string; username: string; role: string } | null;
  csrf: string;
};

export function PostInteractions({
  postSlug,
  postId,
  initialLikes,
  initialLiked,
  initialComments,
  initialCommentTotal,
  user,
  csrf,
}: Props) {
  const [likes, setLikes] = useState(initialLikes);
  const [liked, setLiked] = useState(initialLiked);
  const [comments, setComments] = useState(initialComments);
  const [commentTotal, setCommentTotal] = useState(initialCommentTotal);
  const [content, setContent] = useState("");
  const [name, setName] = useState("");
  const [allowAi, setAllowAi] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [loadingMore, setLoadingMore] = useState(false);
  const toast = useToast();
  const confirm = useConfirm();

  const limit = COMMENT_CHAR_LIMIT;
  const nearLimit = content.length > limit * 0.9;
  const hasMore = comments.length < commentTotal;

  async function toggleLike() {
    setErr(null);
    const was = liked;
    setLiked(!was);
    setLikes((n) => n + (was ? -1 : 1));
    try {
      const res = await fetch("/api/likes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postSlug, csrf }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "failed");
      const j = (await res.json()) as { liked: boolean; count: number };
      setLiked(j.liked);
      setLikes(j.count);
    } catch (e) {
      setLiked(was);
      setLikes((n) => n + (was ? 1 : -1));
      setErr(e instanceof Error ? e.message : "failed");
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!content.trim()) return;
    startTransition(async () => {
      try {
        const res = await fetch("/api/comments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            postSlug,
            content,
            authorName: user ? null : name.trim() || null,
            allowAiTraining: allowAi,
            csrf,
          }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error ?? "failed");
        }
        const fresh: CommentWithAuthor = {
          id: (await res.json()).id,
          content: content.trim(),
          createdAt: new Date(),
          authorName: user
            ? user.username
            : name.trim() || "anonymous",
          isAdmin: user?.role === "admin",
          isAnon: !user,
        };
        setComments((c) => [fresh, ...c]);
        setCommentTotal((n) => n + 1);
        setContent("");
        setAllowAi(false);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "failed");
      }
    });
  }

  async function deleteComment(id: string) {
    const ok = await confirm({
      title: "remove comment?",
      message: "this hides the comment from public view.",
      confirmLabel: "remove",
      destructive: true,
    });
    if (!ok) return;
    try {
      const res = await fetch(`/api/comments?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csrf }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "failed");
      }
      setComments((list) => list.filter((c) => c.id !== id));
      setCommentTotal((n) => Math.max(0, n - 1));
      toast.success("comment removed");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "failed";
      setErr(msg);
      toast.error(msg);
    }
  }

  async function loadMore() {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const url = `/api/comments/list?postId=${encodeURIComponent(postId)}&offset=${comments.length}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("failed to load more");
      const j = (await res.json()) as {
        items: Array<CommentWithAuthor & { createdAt: string }>;
        total: number;
      };
      const parsed = j.items.map((c) => ({
        ...c,
        createdAt: new Date(c.createdAt),
      }));
      // de-dupe by id in case a new comment was posted
      setComments((existing) => {
        const seen = new Set(existing.map((c) => c.id));
        return [...existing, ...parsed.filter((c) => !seen.has(c.id))];
      });
      setCommentTotal(j.total);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "failed to load more");
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div className="mt-16">
      <div className="flex items-center gap-6 py-6 border-y border-default">
        <button
          type="button"
          onClick={toggleLike}
          aria-pressed={liked}
          aria-label={liked ? `unlike (${likes} likes)` : `like (${likes} likes)`}
          className={`inline-flex items-center gap-2 px-4 h-9 rounded-md border text-sm transition-colors ${
            liked
              ? "border-transparent text-white"
              : "border-default hover:bg-surface"
          }`}
          style={liked ? { background: "rgb(var(--accent-light))", color: "rgb(var(--bg))" } : undefined}
        >
          <svg
            aria-hidden="true"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill={liked ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
          {likes}
        </button>
        <span className="text-muted text-sm font-mono">
          {commentTotal} {commentTotal === 1 ? "comment" : "comments"}
        </span>
      </div>

      <h2 className="mt-12 text-2xl font-semibold tracking-tight">comments</h2>

      <form
        onSubmit={submit}
        className="mt-6 border border-default rounded-xl p-5 bg-app space-y-3"
      >
        {!user && (
          <>
            <label htmlFor="comment-name" className="sr-only">
              name
            </label>
            <input
              id="comment-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="name (optional, leave empty for anonymous)"
              maxLength={COMMENT_NAME_LIMIT}
              className="w-full px-3 py-2 rounded-md border border-default bg-surface focus:outline-none focus:ring-2 focus:ring-[rgb(var(--accent-light))] focus:border-transparent text-sm"
            />
          </>
        )}
        <label htmlFor="comment-content" className="sr-only">
          comment
        </label>
        <textarea
          id="comment-content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={
            user
              ? `write something as @${user.username}…`
              : "write something… signed in would let us know it was you."
          }
          rows={4}
          maxLength={limit}
          className="w-full px-3 py-2 rounded-md border border-default bg-surface focus:outline-none focus:ring-2 focus:ring-[rgb(var(--accent-light))] focus:border-transparent text-sm resize-y"
        />
        <div className="flex items-center justify-between">
          <span
            className={`text-[11px] font-mono ${nearLimit ? "text-[rgb(220_60_80)]" : "text-subtle"}`}
          >
            {content.length} / {limit}
          </span>
          <button
            type="submit"
            disabled={pending || !content.trim()}
            className="btn-primary disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {pending ? "posting…" : "post comment"}
          </button>
        </div>
        {err && (
          <p role="alert" className="text-xs font-mono text-[rgb(220_60_80)]">
            {err}
          </p>
        )}

        <label className="flex items-start gap-2.5 text-[12px] text-muted cursor-pointer select-none leading-snug">
          <input
            type="checkbox"
            checked={allowAi}
            onChange={(e) => setAllowAi(e.target.checked)}
            className="mt-0.5 h-3.5 w-3.5 accent-[rgb(var(--accent-light))] shrink-0"
          />
          <span>
            allow this comment to be used to improve vainie&apos;s writing
            assistant (opt-in, off by default).{" "}
            <a href="/privacy#ai" className="link-accent">
              what does this mean?
            </a>
          </span>
        </label>

        {!user && (
          <p className="text-[11px] text-subtle">
            posting anonymously. or{" "}
            <a href="/login" className="link-accent">
              log in
            </a>{" "}
            /{" "}
            <a href="/signup" className="link-accent">
              sign up
            </a>
            .
          </p>
        )}
      </form>

      <ul className="mt-8 space-y-5">
        {comments.length === 0 && (
          <li className="text-muted text-sm">no comments yet. be first.</li>
        )}
        {comments.map((c) => (
          <li
            key={c.id}
            className="border border-default rounded-lg p-4 bg-app group"
          >
            <div className="flex items-baseline gap-2 mb-1.5 flex-wrap">
              <span
                className={`text-sm font-medium ${
                  c.isAdmin ? "text-accent-light" : ""
                }`}
              >
                {c.authorName}
              </span>
              {c.isAdmin && <span className="chip-accent !h-5">author</span>}
              {c.isAnon && !c.isAdmin && (
                <span className="chip !h-5">anon</span>
              )}
              <span className="text-[11px] font-mono text-subtle ml-auto">
                {new Date(c.createdAt).toLocaleDateString("en-GB")}
              </span>
              {user?.role === "admin" && (
                <button
                  type="button"
                  onClick={() => deleteComment(c.id)}
                  aria-label="remove comment (admin)"
                  className="text-[11px] font-mono text-subtle hover:text-[rgb(220_60_80)] transition-colors"
                  title="remove (admin)"
                >
                  remove
                </button>
              )}
            </div>
            <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
              {c.content}
            </p>
          </li>
        ))}
      </ul>

      {hasMore && (
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={loadMore}
            disabled={loadingMore}
            className="btn-ghost !h-8 !px-3 !text-xs disabled:opacity-60"
          >
            {loadingMore
              ? "loading…"
              : `load more (${commentTotal - comments.length} left)`}
          </button>
        </div>
      )}
    </div>
  );
}
