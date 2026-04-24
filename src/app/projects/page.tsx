import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { getAllProjects, STATUS_ORDER, STATUS_LABEL } from "@/lib/projects-all";
import type { Project } from "@/lib/projects";

export const metadata: Metadata = {
  title: "projects — vainie",
  description: "every half-finished idea, one directory at a time.",
};

// dynamic because files on disk can change
export const revalidate = 30;

export default async function ProjectsPage() {
  const all = await getAllProjects();

  const sorted = [...all].sort((a, b) => {
    const s = STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status);
    if (s !== 0) return s;
    return a.name.localeCompare(b.name);
  });

  const counts = sorted.reduce<Record<Project["status"], number>>(
    (acc, p) => ((acc[p.status] = (acc[p.status] ?? 0) + 1), acc),
    { wip: 0, done: 0, paused: 0, concept: 0, planned: 0 },
  );

  const dynamicCount = sorted.filter((p) => p.source === "dynamic").length;

  return (
    <>
      <section className="border-b border-default">
        <div className="container-x py-12 md:py-24 animate-fade-up">
          <div className="eyebrow mb-6">projects</div>
          <h1 className="text-3xl md:text-6xl font-semibold tracking-tight leading-[1.05] max-w-3xl">
            every half-finished idea,{" "}
            <span className="text-accent-light">one directory at a time</span>.
          </h1>
          <p className="text-muted mt-4 md:mt-6 max-w-2xl text-sm md:text-[17px]">
            the archive. games, engines, tiny operating systems, a few sites,
            and at least one language model trained too late at night.
            {dynamicCount > 0 && (
              <span className="block text-subtle text-xs mt-2 font-mono">
                {dynamicCount} auto-indexed from disk · {sorted.length - dynamicCount} archive entries
              </span>
            )}
          </p>

          <div className="mt-8 md:mt-10 flex flex-wrap gap-2 md:gap-3 font-mono text-xs">
            <span className="chip">{sorted.length} total</span>
            {counts.wip > 0 && (
              <span className="chip-accent">{counts.wip} in progress</span>
            )}
            {counts.done > 0 && (
              <span className="chip">{counts.done} done</span>
            )}
            {counts.planned > 0 && (
              <span className="chip">{counts.planned} planned</span>
            )}
            {counts.paused > 0 && (
              <span className="chip">{counts.paused} paused</span>
            )}
            {counts.concept > 0 && (
              <span className="chip">{counts.concept} concept</span>
            )}
          </div>
        </div>
      </section>

      <section className="container-x py-12 md:py-16">
        <ul className="border border-default rounded-xl overflow-hidden divide-y divide-default bg-app">
          {sorted.map((p, i) => (
            <li key={`${p.source ?? "x"}:${p.slug}`}>
              <Link
                href={`/projects/${p.slug}`}
                className="group flex md:grid md:grid-cols-12 gap-3 md:gap-4 items-start md:items-center px-4 md:px-8 py-5 md:py-6 hover:bg-surface transition-colors animate-fade-up"
                style={{ animationDelay: `${Math.min(i, 20) * 0.02}s` }}
              >
                <span className="hidden md:block md:col-span-1 font-mono text-xs text-subtle tabular-nums">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="flex-1 md:col-span-4 flex items-center gap-3 min-w-0">
                  {p.cover && (
                    <div className="relative h-10 w-10 md:h-11 md:w-11 shrink-0 overflow-hidden rounded border border-default bg-surface">
                      <Image
                        src={p.cover}
                        alt=""
                        fill
                        sizes="44px"
                        className="object-cover"
                      />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="md:hidden font-mono text-[11px] text-subtle tabular-nums shrink-0">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <h3 className="text-base md:text-lg font-semibold tracking-tight truncate">
                        {p.name}
                      </h3>
                    </div>
                    <p className="text-muted text-xs md:text-sm mt-0.5 md:hidden line-clamp-2">
                      {p.tagline}
                    </p>
                    <div className="flex md:hidden flex-wrap gap-1.5 mt-2">
                      {p.tech.slice(0, 3).map((t) => (
                        <span key={t} className="chip !h-5 !text-[10px]">
                          {t}
                        </span>
                      ))}
                      {p.tech.length > 3 && (
                        <span className="chip !h-5 !text-[10px] !bg-transparent !border-transparent text-subtle">
                          +{p.tech.length - 3}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <p className="hidden md:block col-span-4 text-muted text-sm truncate">
                  {p.tagline}
                </p>
                <div className="hidden md:flex col-span-2 gap-1.5 flex-wrap">
                  {p.tech.slice(0, 2).map((t) => (
                    <span key={t} className="chip">
                      {t}
                    </span>
                  ))}
                  {p.tech.length > 2 && (
                    <span className="chip !bg-transparent !border-transparent text-subtle">
                      +{p.tech.length - 2}
                    </span>
                  )}
                </div>
                <div className="shrink-0 md:col-span-1 flex items-center gap-2 md:justify-end">
                  <span
                    className={`font-mono text-[10px] md:text-[11px] whitespace-nowrap ${
                      p.status === "paused" || p.status === "concept" || p.status === "planned"
                        ? "text-subtle"
                        : p.status === "done"
                          ? "text-accent-light"
                          : "text-[rgb(var(--fg))]"
                    }`}
                  >
                    {STATUS_LABEL[p.status]}
                  </span>
                  <span className="text-subtle group-hover:text-accent-light group-hover:translate-x-0.5 transition-all hidden md:inline">
                    →
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
