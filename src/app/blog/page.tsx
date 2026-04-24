import type { Metadata } from "next";
import Link from "next/link";
import { listPublishedPosts, countPublishedPosts } from "@/lib/blog";
import { BLOG_PAGE_SIZE } from "@/lib/constants";
import { Pagination } from "@/components/pagination";

export const metadata: Metadata = {
  title: "blog — vainie",
  description: "thoughts, devlogs, and occasional rants.",
};

export const dynamic = "force-dynamic";

function formatDate(d: Date | null): string {
  if (!d) return "—";
  return d.toISOString().slice(0, 10);
}

function parsePage(raw: string | string[] | undefined): number {
  if (typeof raw !== "string") return 1;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, 9999);
}

export default async function BlogIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const sp = await searchParams;
  const page = parsePage(sp.page);
  const offset = (page - 1) * BLOG_PAGE_SIZE;

  const [posts, total] = await Promise.all([
    listPublishedPosts({ limit: BLOG_PAGE_SIZE, offset }),
    countPublishedPosts(),
  ]);

  return (
    <>
      <section className="border-b border-default">
        <div className="container-x py-12 md:py-24 animate-fade-up">
          <div className="eyebrow mb-6">blog</div>
          <h1 className="text-3xl md:text-6xl font-semibold tracking-tight leading-[1.05] max-w-3xl">
            thoughts, <span className="text-accent-light">devlogs</span>,
            occasional rants.
          </h1>
          <p className="text-muted mt-4 md:mt-6 max-w-2xl text-sm md:text-[17px]">
            writing down what i&apos;m working on, why, and what broke this week.
          </p>
        </div>
      </section>

      <section className="container-x py-12 md:py-16">
        {posts.length === 0 ? (
          <div className="border border-dashed border-default rounded-xl p-10 text-center">
            <p className="text-muted">
              {page > 1 ? (
                <>no more posts on this page. <Link href="/blog" className="link-accent">back to page 1</Link></>
              ) : (
                "no posts yet. come back soon."
              )}
            </p>
          </div>
        ) : (
          <>
            <ul className="border border-default rounded-xl overflow-hidden divide-y divide-default bg-app">
              {posts.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/blog/${p.slug}`}
                    className="group flex flex-col md:grid md:grid-cols-12 md:gap-4 md:items-center px-4 md:px-8 py-5 md:py-6 hover:bg-surface transition-colors"
                  >
                    <span className="md:col-span-2 font-mono text-[11px] text-subtle mb-1 md:mb-0">
                      {formatDate(p.publishedAt)}
                    </span>
                    <div className="md:col-span-7 min-w-0">
                      <h3 className="text-base md:text-lg font-semibold tracking-tight">
                        {p.title}
                      </h3>
                      {p.excerpt && (
                        <p className="text-muted text-sm mt-1 line-clamp-2">
                          {p.excerpt}
                        </p>
                      )}
                    </div>
                    <div className="md:col-span-3 flex items-center gap-3 md:justify-end font-mono text-[11px] text-subtle mt-3 md:mt-0">
                      <span aria-label={`${p.likeCount} likes`}>♥ {p.likeCount}</span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {p.commentCount}{" "}
                        {p.commentCount === 1 ? "comment" : "comments"}
                      </span>
                      <span
                        aria-hidden="true"
                        className="hidden md:inline ml-auto text-subtle group-hover:text-accent-light group-hover:translate-x-0.5 transition-all"
                      >
                        →
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>

            <Pagination
              page={page}
              total={total}
              pageSize={BLOG_PAGE_SIZE}
              basePath="/blog"
              label="blog pagination"
            />
          </>
        )}
      </section>
    </>
  );
}
