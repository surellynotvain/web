import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "credits — vainie",
  description:
    "attribution for every external API, library, font, and piece of content this site uses.",
};

type CreditItem = {
  name: string;
  url: string;
  what: string;
  license?: string;
};

type Group = {
  label: string;
  items: CreditItem[];
  note?: string;
};

const GROUPS: Group[] = [
  {
    label: "external APIs",
    note: "fetched server-side, cached, rendered into the page you just loaded.",
    items: [
      {
        name: "Wikipedia",
        url: "https://en.wikipedia.org/api/rest_v1/",
        what: "summaries for the 'things i do' section.",
        license: "CC BY-SA 4.0",
      },
      {
        name: "GitHub GraphQL + REST",
        url: "https://docs.github.com/en/graphql",
        what: "contributions calendar + latest public activity feed.",
      },
      {
        name: "PokéAPI",
        url: "https://pokeapi.co/",
        what: "pokémon-of-the-day sprite, types, and flavor text.",
      },
      {
        name: "catfact.ninja",
        url: "https://catfact.ninja/",
        what: "random cat facts (primary).",
      },
      {
        name: "cat-facts (alexwohlbruck)",
        url: "https://alexwohlbruck.github.io/cat-facts/docs/",
        what: "random cat facts (fallback).",
      },
      {
        name: "Tidal API",
        url: "https://developer.tidal.com/",
        what: "'on repeat' playlist metadata.",
      },
    ],
  },
  {
    label: "libraries",
    items: [
      {
        name: "Next.js",
        url: "https://nextjs.org/",
        what: "the whole framework.",
        license: "MIT",
      },
      {
        name: "React",
        url: "https://react.dev/",
        what: "UI runtime.",
        license: "MIT",
      },
      {
        name: "Tailwind CSS",
        url: "https://tailwindcss.com/",
        what: "styling.",
        license: "MIT",
      },
      {
        name: "Drizzle ORM",
        url: "https://orm.drizzle.team/",
        what: "typed SQL for sqlite.",
        license: "Apache-2.0",
      },
      {
        name: "better-sqlite3",
        url: "https://github.com/WiseLibs/better-sqlite3",
        what: "synchronous sqlite bindings.",
        license: "MIT",
      },
      {
        name: "next-themes",
        url: "https://github.com/pacocoursey/next-themes",
        what: "theme toggle.",
        license: "MIT",
      },
      {
        name: "marked",
        url: "https://marked.js.org/",
        what: "markdown → html for blog posts.",
        license: "MIT",
      },
      {
        name: "isomorphic-dompurify",
        url: "https://github.com/kkomelin/isomorphic-dompurify",
        what: "sanitizing user-rendered html.",
        license: "LGPL-3.0 / Apache-2.0",
      },
      {
        name: "@node-rs/argon2",
        url: "https://github.com/napi-rs/node-rs",
        what: "password hashing.",
        license: "MIT",
      },
      {
        name: "sharp",
        url: "https://sharp.pixelplumbing.com/",
        what: "image resizing, thumbnail generation.",
        license: "Apache-2.0",
      },
      {
        name: "zod",
        url: "https://zod.dev/",
        what: "runtime schema validation.",
        license: "MIT",
      },
    ],
  },
  {
    label: "fonts & design",
    items: [
      {
        name: "Geist Sans + Mono",
        url: "https://vercel.com/font",
        what: "site typefaces.",
        license: "SIL Open Font License 1.1",
      },
    ],
  },
  {
    label: "ai",
    items: [
      {
        name: "OpenRouter",
        url: "https://openrouter.ai/",
        what: "LLM routing used by the post-writing assistant (admin-only).",
      },
    ],
  },
  {
    label: "inspiration & content",
    items: [
      {
        name: "surelynotvain (you)",
        url: "https://github.com/surellynotvain",
        what: "all original writing, projects, and bad jokes.",
      },
    ],
  },
];

export default function CreditsPage() {
  return (
    <div className="container-tight py-12 md:py-16 animate-fade-up">
      <div className="eyebrow mb-5">credits</div>
      <h1 className="text-3xl md:text-5xl font-semibold tracking-tight leading-[1.05]">
        standing on other{" "}
        <span className="text-accent-light">people&apos;s shoulders</span>.
      </h1>
      <p className="text-muted mt-5 text-[16px] leading-relaxed max-w-2xl">
        nothing here is built from scratch. this page is the running list of
        what i borrow, fetch, embed, or include — with links so you can find
        the original.
      </p>

      <div className="mt-10 space-y-10">
        {GROUPS.map((g) => (
          <section key={g.label}>
            <div className="flex items-baseline justify-between mb-4 gap-3">
              <h2 className="text-xl md:text-2xl font-semibold tracking-tight">
                {g.label}
              </h2>
              <span className="font-mono text-[11px] text-subtle">
                {g.items.length}{" "}
                {g.items.length === 1 ? "item" : "items"}
              </span>
            </div>
            {g.note && (
              <p className="text-muted text-sm mb-4 max-w-xl">{g.note}</p>
            )}
            <ul className="border border-default rounded-xl divide-y divide-default overflow-hidden bg-app">
              {g.items.map((item) => (
                <li key={item.name}>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto] gap-3 sm:gap-5 items-center px-4 md:px-5 py-4 hover:bg-surface transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{item.name}</p>
                      {item.license && (
                        <p className="font-mono text-[10px] text-subtle mt-0.5">
                          {item.license}
                        </p>
                      )}
                    </div>
                    <p className="text-sm text-muted min-w-0">{item.what}</p>
                    <span className="font-mono text-[11px] text-subtle shrink-0">
                      ↗
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <div className="mt-12 border border-default rounded-xl p-5 md:p-6 bg-surface/50">
        <p className="eyebrow mb-3">missing something?</p>
        <p className="text-sm leading-relaxed">
          if you made something this site uses and you don&apos;t see yourself
          here, that&apos;s an oversight, not a snub. drop me a note on{" "}
          <Link href="/contact" className="link-accent">
            /contact
          </Link>{" "}
          and i&apos;ll add you.
        </p>
      </div>

      <div className="mt-10 text-[11px] font-mono text-subtle">
        see also: <Link href="/privacy" className="link-accent">privacy &amp; data</Link>
      </div>
    </div>
  );
}
