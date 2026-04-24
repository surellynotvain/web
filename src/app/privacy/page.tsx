import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "privacy & data — vainie",
  description:
    "what data vainie.pl stores about you, why, how long, and how to opt out or delete it.",
};

const lastUpdated = "2026-04-24"; // ISO, update when material changes happen

export default function PrivacyPage() {
  return (
    <div className="container-tight py-12 md:py-16 animate-fade-up">
      <div className="eyebrow mb-5">privacy &amp; data</div>
      <h1 className="text-3xl md:text-5xl font-semibold tracking-tight leading-[1.05]">
        what i <span className="text-accent-light">know</span> about you.
      </h1>
      <p className="text-muted mt-5 text-[16px] leading-relaxed max-w-2xl">
        this page spells out what <b>vainie.pl</b> stores, why, for how long,
        and how you can opt out or get it deleted. plain language, no lawyers.
      </p>
      <p className="font-mono text-[11px] text-subtle mt-3">
        last updated: {lastUpdated}
      </p>

      {/* ---- TL;DR ---- */}
      <section className="mt-10 border border-default rounded-xl p-5 md:p-6 bg-surface/60">
        <p className="eyebrow mb-3">tl;dr</p>
        <ul className="space-y-2 text-[15px] leading-relaxed">
          <li>• no third-party ads, trackers, analytics. none.</li>
          <li>• cookies: only essential (session, csrf, theme, consent).</li>
          <li>• comments and likes are stored in a local sqlite database.</li>
          <li>• i hash visitor IP addresses for rate limiting, nothing else.</li>
          <li>
            • using your comments to train an ai writing assistant is{" "}
            <b>opt-in, off by default</b>.
          </li>
          <li>
            • you can see, export, or delete anything linked to your account at{" "}
            <Link href="/settings" className="link-accent">
              /settings
            </Link>
            .
          </li>
        </ul>
      </section>

      {/* ---- sections ---- */}
      <div className="mt-10 space-y-8">
        <Block id="who" heading="who runs this">
          <p>
            i&apos;m the sole operator of this site.{" "}
            <b>surelynotvain</b> (a person in poland) is both the data controller
            and your point of contact. you can reach me at{" "}
            <a href="mailto:hi@vainie.pl" className="link-accent">
              hi@vainie.pl
            </a>
            . there is no company behind this; it&apos;s a personal site.
          </p>
        </Block>

        <Block id="what" heading="what i store and why">
          <Table
            rows={[
              {
                k: "session id",
                v:
                  "cookie + sqlite row. lets you stay logged in. stored up to 30 days from last use.",
              },
              {
                k: "csrf token",
                v: "short-lived cookie. prevents cross-site request forgery on forms.",
              },
              {
                k: "theme preference",
                v: "cookie set by next-themes. remembers light/dark.",
              },
              {
                k: "consent choice",
                v:
                  "cookie + (for signed-in users) a database row. remembers which optional features you've opted into/out of.",
              },
              {
                k: "comments",
                v:
                  "content + display name (if given) + timestamp + hashed IP. kept until you or i delete them.",
              },
              {
                k: "likes",
                v:
                  "post id + a random cookie id (if not logged in) or user id (if logged in). used to prevent double-likes.",
              },
              {
                k: "hashed IP",
                v:
                  "sha-256 of your IP + a site salt. used only for rate-limiting abusive endpoints. never the raw IP.",
              },
              {
                k: "account (if you signed up)",
                v:
                  "username, optional email, password hash (argon2id). oauth users also have provider id + optional avatar URL. deleted on request.",
              },
              {
                k: "uploads (admin only)",
                v:
                  "image files you choose when writing posts. stored locally under /public/uploads.",
              },
            ]}
          />
        </Block>

        <Block id="not" heading="what i do NOT store">
          <ul className="space-y-1.5 list-disc pl-5">
            <li>your raw IP address. i hash it on receipt and forget the original.</li>
            <li>any third-party analytics, pixel, or ad tracker.</li>
            <li>location data beyond the country-level hint your IP might suggest.</li>
            <li>browser fingerprints, device identifiers, or behavioral profiles.</li>
            <li>
              anything from the external APIs i call (wikipedia, pokéapi, etc)
              — those calls go out from my server, not your browser.
            </li>
          </ul>
        </Block>

        <Block id="cookies" heading="cookies">
          <p className="mb-4">
            i only set cookies in these categories:
          </p>
          <Table
            rows={[
              { k: "essential", v: "session, csrf, consent choice. cannot be disabled — the site doesn't work without them." },
              { k: "functional", v: "theme (light/dark). optional; disabling it means the site won't remember your pick." },
              { k: "optional", v: "none right now. if i ever add them, they'll default to OFF and show up in /settings." },
            ]}
          />
        </Block>

        <Block id="ai" heading="ai training — opt-in only">
          <p className="mb-3">
            i&apos;m building a small writing assistant that may, eventually, be
            fine-tuned on real examples of thoughtful comments people have left
            on this site. this is a <b>secondary purpose</b> separate from
            showing comments on a blog, so:
          </p>
          <ul className="space-y-1.5 list-disc pl-5 mb-3">
            <li>
              every comment form has an <b>opt-in checkbox</b>, off by default.
            </li>
            <li>
              only comments where the author checked the box can ever be used.
            </li>
            <li>
              logged-in users can flip a global switch in{" "}
              <Link href="/settings" className="link-accent">/settings</Link>.
            </li>
            <li>
              i will never include comments containing personal data (emails,
              phone numbers, physical addresses) even if opted in.
            </li>
            <li>
              if you change your mind later, emailing me is enough — i&apos;ll
              drop anything you wrote from any future training data.
            </li>
          </ul>
          <p>
            no training has happened yet. this section is forward-looking; when
            it starts, i&apos;ll update this page and notify via the site.
          </p>
        </Block>

        <Block id="rights" heading="your rights (gdpr)">
          <p className="mb-3">
            you&apos;re in the EU/poland, so you have the standard GDPR rights:
          </p>
          <ul className="space-y-1.5 list-disc pl-5">
            <li>access: ask me what i have about you.</li>
            <li>export: get a copy (json).</li>
            <li>correction: fix anything wrong.</li>
            <li>deletion (&ldquo;right to be forgotten&rdquo;).</li>
            <li>object to processing for any optional purpose.</li>
            <li>
              complain to the polish data protection authority (uodo). i&apos;d
              rather you just email me first, though.
            </li>
          </ul>
          <p className="mt-3">
            if you have an account, self-service: go to{" "}
            <Link href="/settings" className="link-accent">/settings</Link>.
            otherwise, email{" "}
            <a href="mailto:hi@vainie.pl" className="link-accent">
              hi@vainie.pl
            </a>{" "}
            and mention what you want deleted/exported.
          </p>
        </Block>

        <Block id="security" heading="security">
          <p>
            passwords use argon2id with per-user salts. sessions are random 48-byte
            tokens in http-only cookies. forms use a csrf token.
            i check new passwords against a bloom filter of known-leaked passwords
            (no plaintext sent off-site). the site runs behind nginx with
            strict security headers. nothing is perfect; if you find an issue,
            please tell me privately at{" "}
            <a href="mailto:hi@vainie.pl" className="link-accent">
              hi@vainie.pl
            </a>
            .
          </p>
        </Block>

        <Block id="changes" heading="changes to this policy">
          <p>
            if anything material changes, i&apos;ll update the date at the top
            and, for logged-in users, raise a one-time banner the next time you
            visit. trivial changes (typos, rewording) don&apos;t bump the date.
          </p>
        </Block>
      </div>

      <div className="mt-12 text-[11px] font-mono text-subtle">
        see also: <Link href="/credits" className="link-accent">credits</Link>
      </div>
    </div>
  );
}

function Block({
  id,
  heading,
  children,
}: {
  id: string;
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="text-xl md:text-2xl font-semibold tracking-tight mb-3">
        <a href={`#${id}`} className="hover:text-accent-light">
          {heading}
        </a>
      </h2>
      <div className="text-[15px] leading-relaxed space-y-3 text-[rgb(var(--fg))] max-w-2xl">
        {children}
      </div>
    </section>
  );
}

function Table({ rows }: { rows: Array<{ k: string; v: string }> }) {
  return (
    <div className="border border-default rounded-xl overflow-hidden divide-y divide-default bg-app">
      {rows.map((r) => (
        <div
          key={r.k}
          className="grid grid-cols-1 sm:grid-cols-[10rem_minmax(0,1fr)] gap-2 sm:gap-5 px-4 md:px-5 py-3"
        >
          <p className="font-mono text-[12px] text-subtle">{r.k}</p>
          <p className="text-sm leading-relaxed">{r.v}</p>
        </div>
      ))}
    </div>
  );
}
