import Link from "next/link";

type Props = {
  /** current page (1-indexed) */
  page: number;
  /** total item count */
  total: number;
  /** items per page */
  pageSize: number;
  /** base path; query will append ?page=N (or &page=N if basePath already has one) */
  basePath: string;
  /** optional: aria-label for the <nav> */
  label?: string;
};

function hrefFor(basePath: string, page: number): string {
  if (page <= 1) {
    // drop the page param for the canonical first page
    return basePath.split("?")[0];
  }
  const sep = basePath.includes("?") ? "&" : "?";
  return `${basePath}${sep}page=${page}`;
}

/**
 * Server component. Renders prev / page-count / next.
 * Uses real <Link>s so it's crawlable and works without JS.
 */
export function Pagination({
  page,
  total,
  pageSize,
  basePath,
  label = "pagination",
}: Props) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  const prev = Math.max(1, page - 1);
  const next = Math.min(totalPages, page + 1);

  return (
    <nav
      aria-label={label}
      className="mt-10 flex items-center justify-between gap-4 font-mono text-xs"
    >
      {page > 1 ? (
        <Link
          href={hrefFor(basePath, prev)}
          className="btn-ghost !h-8 !px-3 !text-xs"
          aria-label="previous page"
          rel="prev"
        >
          ← prev
        </Link>
      ) : (
        <span
          aria-hidden="true"
          className="inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-md text-xs text-subtle border border-default opacity-50"
        >
          ← prev
        </span>
      )}

      <span className="text-subtle tabular-nums">
        page {page} / {totalPages}
      </span>

      {page < totalPages ? (
        <Link
          href={hrefFor(basePath, next)}
          className="btn-ghost !h-8 !px-3 !text-xs"
          aria-label="next page"
          rel="next"
        >
          next →
        </Link>
      ) : (
        <span
          aria-hidden="true"
          className="inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-md text-xs text-subtle border border-default opacity-50"
        >
          next →
        </span>
      )}
    </nav>
  );
}
