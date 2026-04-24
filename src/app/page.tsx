import Link from "next/link";
import Image from "next/image";
import { Suspense } from "react";
import { getAllProjects } from "@/lib/projects-all";
import { listPublishedPosts } from "@/lib/blog";
import { getWikiSummaryAny, type WikiSummary } from "@/lib/wikipedia";
import { getRandomCatFact } from "@/lib/cat-facts";
import { getPokemonOfTheDay } from "@/lib/pokeapi";
import { getLatestGithubActivity } from "@/lib/github";
import { ContribCalendar } from "@/components/contrib-calendar";
import { TidalPlaylist } from "@/components/tidal-playlist";
import { TidalEmbed } from "@/components/tidal-embed";
import { PageToc } from "@/components/page-toc";

export const revalidate = 300; // 5 min; individual fetches have their own cache

const TIDAL_PLAYLIST_ID = "a7fd23a4-8362-4d18-b2b8-ae6f8610b112";

type Role = {
  id: string;
  label: string;
  /** candidate wikipedia titles, first hit wins */
  wikiCandidates: string[];
  blurb: string;
};

const ROLES: Role[] = [
  {
    id: "developer",
    label: "developer",
    wikiCandidates: ["Software developer", "Software engineering"],
    blurb: "shipping web and app work end-to-end.",
  },
  {
    id: "it",
    label: "it",
    wikiCandidates: ["Information technology"],
    blurb: "the day-to-day infrastructure behind the rest of it.",
  },
  {
    id: "ai",
    label: "ai engineer / researcher",
    wikiCandidates: [
      "Artificial intelligence",
      "Machine learning",
      "AI engineer",
    ],
    blurb: "building, breaking, and reading about models.",
  },
  {
    id: "support",
    label: "it support",
    wikiCandidates: ["Technical support", "IT support"],
    blurb: "fixing things that nobody wants to touch.",
  },
  {
    id: "sysops",
    label: "server maintenance",
    wikiCandidates: ["System administrator", "Server administrator"],
    blurb: "keeping boxes happy, patched, and online.",
  },
];

const STACK: Array<{ label: string; items: string[] }> = [
  {
    label: "web / app",
    items: ["next.js", "react", "typescript", "tailwind", "node"],
  },
  {
    label: "ai / ml",
    items: ["pytorch", "transformers", "openrouter", "local llms", "rag"],
  },
  {
    label: "infra / ops",
    items: ["linux", "nginx", "systemd", "sqlite", "docker"],
  },
];

const VIBES = [
  "shipping small, honest things",
  "long-running projects over hype",
  "self-hosting when it makes sense",
  "reading papers, then breaking the code",
  "polish, but the country — and the verb",
];

// TOC order — matches section rendering order below.
const TOC_SECTIONS = [
  { id: "hero", label: "intro" },
  { id: "about", label: "about" },
  { id: "things-i-do", label: "things i do" },
  { id: "stack", label: "stack & vibes" },
  { id: "github", label: "github" },
  { id: "latest-post", label: "latest post" },
  { id: "on-repeat", label: "on repeat" },
  { id: "fun", label: "just for fun" },
];

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function truncateExtract(s: string, max = 260): string {
  if (s.length <= max) return s;
  return s.slice(0, max).replace(/\s+\S*$/, "") + "…";
}

export default async function HomePage() {
  const [allProjects, latestPosts, roleSummaries, catFact, pokemon, activity] =
    await Promise.all([
      getAllProjects(),
      listPublishedPosts({ limit: 1 }),
      Promise.all(ROLES.map((r) => getWikiSummaryAny(r.wikiCandidates))),
      getRandomCatFact(),
      getPokemonOfTheDay(),
      getLatestGithubActivity(),
    ]);

  const totalCount = allProjects.length;
  const latestPost = latestPosts[0] ?? null;

  return (
    <div className="container-wide mx-auto px-6 md:px-8 max-w-7xl lg:grid lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-12">
      <PageToc sections={TOC_SECTIONS} />

      <div className="min-w-0">
        {/* ==================== HERO ==================== */}
        <section
          id="hero"
          aria-label="intro"
          className="relative border-b border-default -mx-6 md:-mx-8 lg:mx-0"
        >
          <div className="absolute inset-0 bg-grid bg-grid-fade pointer-events-none" />
          <div className="relative px-6 md:px-8 lg:px-0 py-12 md:py-24 lg:py-28">
            <div className="animate-fade-up max-w-3xl">
              <div className="eyebrow mb-5">surelynotvain · vainie · pl</div>
              <h1 className="text-4xl sm:text-5xl md:text-7xl font-semibold tracking-tight leading-[1.05]">
                webdev, appdev,
                <br />
                <span className="text-accent-light">ai &amp; infra</span>.
              </h1>
              <p className="text-muted text-base md:text-xl mt-5 max-w-2xl leading-relaxed">
                i&apos;m surelynotvain — from poland. webdev, appdev, it support,
                server maintenance, ai engineering and ai research. this site is
                the catalog.
              </p>
              <div className="flex flex-wrap gap-3 mt-7">
                <Link href="/projects" className="btn-primary">
                  {totalCount > 0 ? `see ${totalCount} projects` : "projects"}
                  <svg
                    aria-hidden="true"
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                  >
                    <path d="M5 12h14M13 5l7 7-7 7" />
                  </svg>
                </Link>
                <Link href="#about" className="btn-ghost">
                  more about me
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ==================== ABOUT ==================== */}
        <Section id="about" eyebrow="about" title={
          <>a tiny <span className="text-accent-light">dossier</span> on <span className="whitespace-nowrap">surelynotvain</span>.</>
        }>
          <div className="grid grid-cols-2 gap-px bg-default border border-default rounded-xl overflow-hidden">
            {[
              { label: "name", value: "surelynotvain" },
              { label: "from", value: "poland" },
              { label: "role", value: "webdev · appdev · ai" },
              { label: "also", value: "it support · server maint." },
            ].map((x) => (
              <div key={x.label} className="bg-app p-4 md:p-5">
                <p className="eyebrow mb-2">{x.label}</p>
                <p className="text-base md:text-lg font-medium">{x.value}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 space-y-5 text-[16px] md:text-[17px] leading-[1.7] text-[rgb(var(--fg))] max-w-3xl">
            <p>
              i&apos;m <b>surelynotvain</b>. based in poland, i work across the
              stack — <b>webdev</b>, <b>appdev</b>, <b>it support</b>,{" "}
              <b>server maintenance</b>, and <b>ai engineering / research</b>.
            </p>
            <p>
              most of what you&apos;ll find here comes out of that loop: build
              something small, break it, write about it, repeat.{" "}
              <i className="text-accent-light font-semibold not-italic">vainie</i>{" "}
              is just the softer version of the handle — and where the site&apos;s
              name comes from.
            </p>
          </div>
        </Section>

        {/* ==================== THINGS I DO (list form with wikipedia) ==================== */}
        <Section id="things-i-do" eyebrow="things i do" title={
          <>five hats, <span className="text-accent-light">one head</span>.</>
        } hint="short summaries pulled from wikipedia — my own take in bold.">
          <ol className="border border-default rounded-xl divide-y divide-default overflow-hidden bg-app">
            {ROLES.map((r, i) => (
              <RoleListItem
                key={r.id}
                n={i + 1}
                role={r}
                summary={roleSummaries[i]}
              />
            ))}
          </ol>
          <p className="mt-4 text-[11px] font-mono text-subtle">
            summaries via wikipedia (CC BY-SA 4.0) — see{" "}
            <Link href="/credits" className="link-accent">
              credits
            </Link>
            .
          </p>
        </Section>

        {/* ==================== STACK & VIBES ==================== */}
        <Section id="stack" compact>
          <div className="grid md:grid-cols-[2fr_1fr] gap-6 md:gap-10">
            <div>
              <div className="eyebrow mb-4">stack</div>
              <div className="grid sm:grid-cols-3 gap-px bg-default border border-default rounded-xl overflow-hidden">
                {STACK.map((group) => (
                  <div key={group.label} className="bg-app p-4 md:p-5">
                    <p className="eyebrow mb-3">{group.label}</p>
                    <ul className="space-y-1.5">
                      {group.items.map((item) => (
                        <li
                          key={item}
                          className="text-sm font-mono text-[rgb(var(--fg))]"
                        >
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="eyebrow mb-4">vibes</div>
              <ul className="border border-default rounded-xl divide-y divide-default overflow-hidden">
                {VIBES.map((v, i) => (
                  <li
                    key={v}
                    className="px-4 py-2.5 flex items-center gap-3 hover:bg-surface transition-colors"
                  >
                    <span className="font-mono text-[11px] text-subtle w-5">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="text-sm leading-snug">{v}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Section>

        {/* ==================== GITHUB ==================== */}
        <Section id="github" eyebrow="github" title={
          <>what i&apos;ve been <span className="text-accent-light">pushing</span>.</>
        }>
          <div className="grid lg:grid-cols-[1fr_300px] gap-4 lg:gap-5">
            <ContribCalendar />
            {activity ? (
              <a
                href={activity.url ?? activity.repoUrl}
                target="_blank"
                rel="noreferrer"
                className="border border-default rounded-xl p-4 md:p-5 hover:bg-surface transition-colors flex flex-col gap-2.5"
              >
                <div className="flex items-center justify-between">
                  <span className="eyebrow">latest</span>
                  <span className="font-mono text-[10px] text-subtle">
                    {formatRelative(activity.createdAt)}
                  </span>
                </div>
                <p className="text-sm leading-relaxed break-words">
                  {activity.summary}
                </p>
                <span className="font-mono text-[11px] text-subtle truncate mt-auto">
                  {activity.repo} ↗
                </span>
              </a>
            ) : (
              <div className="border border-default rounded-xl p-5 bg-surface/40 flex items-center">
                <p className="text-subtle text-sm font-mono">— no activity</p>
              </div>
            )}
          </div>
        </Section>

        {/* ==================== LATEST POST ==================== */}
        {latestPost && (
          <Section
            id="latest-post"
            eyebrow="latest post"
            action={
              <Link href="/blog" className="btn-ghost !h-8 !px-3 !text-xs">
                all posts →
              </Link>
            }
            compact
          >
            <Link
              href={`/blog/${latestPost.slug}`}
              className="group block border border-default rounded-xl overflow-hidden hover:bg-surface transition-colors"
            >
              <div className="grid md:grid-cols-[auto_1fr] gap-4 md:gap-6 p-4 md:p-6 items-center">
                {latestPost.coverUrl && (
                  <div className="relative w-full md:w-40 aspect-video md:aspect-square rounded-lg overflow-hidden border border-default bg-surface shrink-0">
                    <Image
                      src={latestPost.coverUrl}
                      alt=""
                      fill
                      sizes="(min-width: 768px) 160px, 100vw"
                      className="object-cover"
                    />
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-2 font-mono text-[11px] text-subtle">
                    <span>
                      {latestPost.publishedAt
                        ? new Date(latestPost.publishedAt).toISOString().slice(0, 10)
                        : "draft"}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>by {latestPost.authorUsername}</span>
                  </div>
                  <h3 className="text-lg md:text-2xl font-semibold tracking-tight group-hover:text-accent-light transition-colors">
                    {latestPost.title}
                  </h3>
                  {latestPost.excerpt && (
                    <p className="text-muted text-sm md:text-[15px] mt-2 line-clamp-2">
                      {latestPost.excerpt}
                    </p>
                  )}
                  <div className="mt-3 flex items-center gap-3 font-mono text-[11px] text-subtle">
                    <span aria-label={`${latestPost.likeCount} likes`}>
                      ♥ {latestPost.likeCount}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {latestPost.commentCount}{" "}
                      {latestPost.commentCount === 1 ? "comment" : "comments"}
                    </span>
                    <span
                      aria-hidden="true"
                      className="ml-auto text-subtle group-hover:text-accent-light group-hover:translate-x-0.5 transition-all"
                    >
                      read →
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          </Section>
        )}

        {/* ==================== ON REPEAT ==================== */}
        <Section id="on-repeat" eyebrow="on repeat" rightEyebrow="tidal" compact>
          <div className="space-y-3">
            <TidalEmbed playlistId={TIDAL_PLAYLIST_ID} />
            <Suspense fallback={<PlaylistSkeleton />}>
              <TidalPlaylist playlistId={TIDAL_PLAYLIST_ID} limit={50} />
            </Suspense>
          </div>
        </Section>

        {/* ==================== FUN FACTS ==================== */}
        <Section id="fun" eyebrow="just for fun" compact lastSection>
          <div className="grid md:grid-cols-2 gap-4">
            <CatFactCard fact={catFact} />
            <PokemonCard pokemon={pokemon} />
          </div>
        </Section>
      </div>
    </div>
  );
}

/* =====================================================================
 * sub-components (server)
 * ===================================================================== */

function Section({
  id,
  eyebrow,
  rightEyebrow,
  title,
  hint,
  action,
  compact = false,
  lastSection = false,
  children,
}: {
  id: string;
  eyebrow?: string;
  rightEyebrow?: string;
  title?: React.ReactNode;
  hint?: string;
  action?: React.ReactNode;
  compact?: boolean;
  lastSection?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className={
        lastSection ? "" : "border-b border-default"
      }
    >
      <div className={compact ? "py-10 md:py-14" : "py-12 md:py-16"}>
        {(eyebrow || title) && (
          <div className="flex items-end justify-between flex-wrap gap-4 mb-6 md:mb-8">
            <div>
              <div className="flex items-center gap-3 mb-2">
                {eyebrow && <div className="eyebrow">{eyebrow}</div>}
                {rightEyebrow && (
                  <span className="font-mono text-[10px] uppercase tracking-widest text-subtle">
                    — {rightEyebrow}
                  </span>
                )}
              </div>
              {title && (
                <h2 className="text-xl md:text-3xl font-semibold tracking-tight leading-tight max-w-3xl">
                  {title}
                </h2>
              )}
              {hint && (
                <p className="text-muted text-sm mt-2 max-w-xl">{hint}</p>
              )}
            </div>
            {action}
          </div>
        )}
        {children}
      </div>
    </section>
  );
}

function RoleListItem({
  n,
  role,
  summary,
}: {
  n: number;
  role: Role;
  summary: WikiSummary | null;
}) {
  return (
    <li className="p-4 md:p-5 hover:bg-surface transition-colors">
      <div className="grid grid-cols-[auto_1fr_auto] gap-4 items-start">
        <span className="font-mono text-xs text-subtle tabular-nums pt-0.5">
          {String(n).padStart(2, "0")}
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-1">
            <h3 className="text-base md:text-lg font-semibold tracking-tight">
              {role.label}
            </h3>
            <span className="text-[13px] text-accent-light font-medium">
              {role.blurb}
            </span>
          </div>
          {summary ? (
            <p className="text-sm text-muted leading-relaxed">
              {truncateExtract(summary.extract)}
            </p>
          ) : (
            <p className="text-sm text-subtle font-mono">— summary unavailable</p>
          )}
        </div>
        {summary && (
          <a
            href={summary.url}
            target="_blank"
            rel="noreferrer noopener"
            className="font-mono text-[10px] text-subtle hover:text-accent-light transition-colors shrink-0 pt-1"
            aria-label={`${role.label} on wikipedia`}
          >
            wiki ↗
          </a>
        )}
      </div>
    </li>
  );
}

function CatFactCard({
  fact,
}: {
  fact: Awaited<ReturnType<typeof getRandomCatFact>>;
}) {
  return (
    <div className="border border-default rounded-xl p-4 md:p-5 bg-app flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="eyebrow">cat fact</span>
        <span className="font-mono text-[10px] text-subtle" aria-hidden="true">🐾</span>
      </div>
      {fact ? (
        <>
          <p className="text-[15px] leading-relaxed flex-1">{fact.text}</p>
          <a
            href={fact.url}
            target="_blank"
            rel="noreferrer noopener"
            className="font-mono text-[10px] text-subtle hover:text-accent-light transition-colors"
          >
            via {fact.source} ↗
          </a>
        </>
      ) : (
        <p className="text-sm text-subtle font-mono">— couldn&apos;t reach the cats</p>
      )}
    </div>
  );
}

function PokemonCard({
  pokemon,
}: {
  pokemon: Awaited<ReturnType<typeof getPokemonOfTheDay>>;
}) {
  if (!pokemon) {
    return (
      <div className="border border-default rounded-xl p-4 md:p-5 bg-app">
        <span className="eyebrow">pokémon of the day</span>
        <p className="text-sm text-subtle font-mono mt-3">— unreachable</p>
      </div>
    );
  }

  return (
    <div className="border border-default rounded-xl p-4 md:p-5 bg-app flex items-start gap-4">
      <div className="relative w-24 h-24 shrink-0">
        {pokemon.spriteUrl ? (
          <Image
            src={pokemon.spriteUrl}
            alt={pokemon.name}
            fill
            sizes="96px"
            className="object-contain drop-shadow-sm"
          />
        ) : (
          <div className="w-full h-full rounded bg-surface" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between mb-1.5 gap-2">
          <span className="eyebrow">pokémon of the day</span>
          <span className="font-mono text-[10px] text-subtle">
            #{String(pokemon.id).padStart(4, "0")}
          </span>
        </div>
        <h3 className="text-lg font-semibold tracking-tight capitalize">
          {pokemon.name}
        </h3>
        <div className="flex gap-1.5 mt-1.5 flex-wrap">
          {pokemon.types.map((t) => (
            <span key={t} className="chip !h-5 !text-[10px] capitalize">
              {t}
            </span>
          ))}
        </div>
        {pokemon.flavorText && (
          <p className="text-xs text-muted mt-2.5 leading-snug line-clamp-3">
            {pokemon.flavorText}
          </p>
        )}
        <p className="font-mono text-[10px] text-subtle mt-2">via pokéapi.co</p>
      </div>
    </div>
  );
}

function PlaylistSkeleton() {
  return (
    <div className="border border-default rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-default bg-surface flex justify-between">
        <span className="font-mono text-[10px] uppercase tracking-widest text-subtle">
          loading playlist…
        </span>
      </div>
      <div className="divide-y divide-default">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="grid grid-cols-[2.5rem_1fr_auto] gap-4 px-5 py-3 items-center"
          >
            <div className="h-3 w-5 bg-surface rounded animate-pulse" />
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 bg-surface rounded-sm animate-pulse" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-1/2 bg-surface rounded animate-pulse" />
                <div className="h-2.5 w-1/3 bg-surface rounded animate-pulse" />
              </div>
            </div>
            <div className="h-3 w-8 bg-surface rounded animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
