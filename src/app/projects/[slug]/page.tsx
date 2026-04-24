import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getAllProjects, getProjectBySlug, STATUS_LABEL, STATUS_ORDER } from "@/lib/projects-all";
import { renderMarkdown, autoRelNoopener } from "@/lib/markdown";

export const revalidate = 30;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const p = await getProjectBySlug(slug);
  if (!p) return { title: "not found — vainie" };
  return { title: `${p.name} — vainie`, description: p.tagline };
}

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const p = await getProjectBySlug(slug);
  if (!p) notFound();

  const all = await getAllProjects();
  const order = [...all].sort((a, b) => {
    const s = STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status);
    if (s !== 0) return s;
    return a.name.localeCompare(b.name);
  });
  const idx = order.findIndex((x) => x.slug === p.slug);
  const prev = idx > 0 ? order[idx - 1] : null;
  const next = idx < order.length - 1 ? order[idx + 1] : null;

  return (
    <article className="container-tight py-16 md:py-24 animate-fade-up">
      <Link
        href="/projects"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-[rgb(var(--fg))] transition-colors mb-10"
      >
        <span>←</span> all projects
      </Link>

      <div className="eyebrow mb-5">{STATUS_LABEL[p.status]}</div>
      <h1 className="text-5xl md:text-6xl font-semibold tracking-tight leading-[1.05]">
        {p.name}
      </h1>
      <p className="text-muted text-xl mt-4">{p.tagline}</p>

      {p.cover && (
        <div className="mt-10 border border-default rounded-xl overflow-hidden bg-surface">
          <Image
            src={p.cover}
            alt={p.name}
            width={1600}
            height={900}
            sizes="(min-width: 768px) 720px, 100vw"
            className="w-full h-auto block"
            priority
          />
        </div>
      )}

      <div className="divider my-12" />

      {p.about ? (
        <div
          className="prose-post"
          dangerouslySetInnerHTML={{ __html: autoRelNoopener(renderMarkdown(p.about)) }}
        />
      ) : (
        <p className="text-muted text-[17px]">no description yet.</p>
      )}

      <div className="divider my-12" />

      <div className="grid grid-cols-2 gap-px bg-default border border-default rounded-xl overflow-hidden">
        <div className="bg-app p-5">
          <p className="eyebrow mb-2">status</p>
          <p className="text-base font-medium">{STATUS_LABEL[p.status]}</p>
        </div>
        <div className="bg-app p-5">
          <p className="eyebrow mb-2">source</p>
          <p className="text-base font-medium font-mono">
            {p.source === "dynamic" ? "auto (disk)" : "archive"}
          </p>
        </div>
        <div className="bg-app p-5 col-span-2">
          <p className="eyebrow mb-3">tech</p>
          <div className="flex flex-wrap gap-2">
            {p.tech.length > 0 ? (
              p.tech.map((t) => (
                <span key={t} className="chip">
                  {t}
                </span>
              ))
            ) : (
              <span className="text-subtle font-mono text-xs">—</span>
            )}
          </div>
        </div>
      </div>

      {p.links && p.links.length > 0 && (
        <div className="mt-10 flex flex-wrap gap-3">
          {p.links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              target="_blank"
              rel="noreferrer"
              className="btn-ghost"
            >
              {l.label} ↗
            </a>
          ))}
        </div>
      )}

      <div className="mt-20 grid grid-cols-2 gap-4 border-t border-default pt-8">
        {prev ? (
          <Link
            href={`/projects/${prev.slug}`}
            className="group flex flex-col gap-1 p-4 -m-4 rounded-lg hover:bg-surface transition-colors"
          >
            <span className="eyebrow">prev</span>
            <span className="text-sm font-medium group-hover:text-accent-light transition-colors">
              ← {prev.name}
            </span>
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link
            href={`/projects/${next.slug}`}
            className="group flex flex-col gap-1 p-4 -m-4 rounded-lg hover:bg-surface transition-colors text-right items-end"
          >
            <span className="eyebrow">next</span>
            <span className="text-sm font-medium group-hover:text-accent-light transition-colors">
              {next.name} →
            </span>
          </Link>
        ) : (
          <span />
        )}
      </div>
    </article>
  );
}
