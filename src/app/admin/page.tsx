import { redirect } from "next/navigation";
import { getCurrentUser, generateCsrfToken } from "@/lib/auth";
import { listAllPostsForAdmin, countAllPostsForAdmin } from "@/lib/blog";
import { ADMIN_PAGE_SIZE } from "@/lib/constants";
import Link from "next/link";
import { AdminPostRowActions } from "@/components/admin-post-row-actions";
import { Pagination } from "@/components/pagination";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "admin — vainie",
  robots: { index: false, follow: false },
};

function parsePage(raw: string | string[] | undefined): number {
  if (typeof raw !== "string") return 1;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, 9999);
}

export default async function AdminIndex({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin");
  if (user.role !== "admin") redirect("/");

  const sp = await searchParams;
  const page = parsePage(sp.page);
  const offset = (page - 1) * ADMIN_PAGE_SIZE;

  const [posts, total, csrf] = await Promise.all([
    listAllPostsForAdmin({ limit: ADMIN_PAGE_SIZE, offset }),
    countAllPostsForAdmin(),
    generateCsrfToken(),
  ]);

  return (
    <div className="container-x py-16 md:py-20">
      <div className="flex items-end justify-between flex-wrap gap-4 mb-10">
        <div>
          <div className="eyebrow mb-5">admin</div>
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight">
            your <span className="text-accent-light">posts</span>.
          </h1>
          <p className="text-muted text-sm mt-2 font-mono">
            {total} {total === 1 ? "post" : "posts"} total
          </p>
        </div>
        <Link href="/admin/new" className="btn-primary">
          + new post
        </Link>
      </div>

      {posts.length === 0 ? (
        <div className="border border-dashed border-default rounded-xl p-10 text-center">
          <p className="text-muted">
            {page > 1 ? (
              <>no more posts. <Link href="/admin" className="link-accent">back to page 1</Link></>
            ) : (
              "no posts yet. start writing."
            )}
          </p>
        </div>
      ) : (
        <>
          <ul className="border border-default rounded-xl overflow-hidden divide-y divide-default bg-app">
            {posts.map((p) => (
              <li key={p.id}>
                <div className="grid grid-cols-12 gap-4 items-center px-5 md:px-8 py-5">
                  <div className="col-span-12 md:col-span-6">
                    <Link
                      href={`/admin/post/${p.id}`}
                      className="text-base font-semibold tracking-tight hover:text-accent-light transition-colors"
                    >
                      {p.title}
                    </Link>
                    {p.excerpt && (
                      <p className="text-muted text-sm mt-1 line-clamp-1">
                        {p.excerpt}
                      </p>
                    )}
                  </div>
                  <div className="col-span-6 md:col-span-3 font-mono text-[11px] text-subtle">
                    {p.publishedAt
                      ? `published ${p.publishedAt.toISOString().slice(0, 10)}`
                      : "draft"}
                  </div>
                  <div className="col-span-6 md:col-span-2 flex gap-3 justify-end md:justify-start font-mono text-[11px] text-subtle">
                    <span aria-label={`${p.likeCount} likes`}>♥ {p.likeCount}</span>
                    <span aria-hidden="true">·</span>
                    <span>{p.commentCount}</span>
                  </div>
                  <div className="col-span-12 md:col-span-1 flex justify-end">
                    <AdminPostRowActions postId={p.id} csrf={csrf} />
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <Pagination
            page={page}
            total={total}
            pageSize={ADMIN_PAGE_SIZE}
            basePath="/admin"
            label="admin pagination"
          />
        </>
      )}
    </div>
  );
}
