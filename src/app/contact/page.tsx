import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "contact — vainie",
  description: "get in touch with surelynotvain.",
};

const socials = [
  { label: "email",   handle: "hi@vainie.pl",     href: "mailto:hi@vainie.pl" },
  { label: "github",  handle: "@surellynotvain",  href: "https://github.com/surellynotvain" },
  { label: "youtube", handle: "@surelynotvain",   href: "https://www.youtube.com/@surelynotvain" },
];

export default function ContactPage() {
  return (
    <>
      <section className="border-b border-default">
        <div className="container-tight py-16 md:py-24 animate-fade-up">
          <div className="eyebrow mb-6">contact</div>
          <h1 className="text-3xl md:text-6xl font-semibold tracking-tight leading-[1.05]">
            say <span className="text-accent">hi</span>.
          </h1>
          <p className="text-muted mt-6 text-[17px] max-w-xl">
            i answer most messages. if i don&apos;t, it&apos;s probably because
            i broke my build again. pick your poison:
          </p>
        </div>
      </section>

      <section className="container-x py-16 md:py-20">
        <ul className="border border-default rounded-xl overflow-hidden divide-y divide-default max-w-3xl mx-auto">
          {socials.map((s, i) => (
            <li key={s.label}>
              <a
                href={s.href}
                target={s.href.startsWith("http") ? "_blank" : undefined}
                rel="noreferrer"
                className="group grid grid-cols-12 items-center px-5 md:px-8 py-5 hover:bg-surface transition-colors animate-fade-up"
                style={{ animationDelay: `${i * 0.04}s` }}
              >
                <span className="col-span-1 font-mono text-xs text-subtle">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="col-span-4 md:col-span-3 text-sm eyebrow !text-[rgb(var(--fg))] !normal-case !tracking-normal !font-sans !text-base font-medium">
                  {s.label}
                </span>
                <span className="col-span-6 md:col-span-7 text-muted text-sm font-mono truncate">
                  {s.handle}
                </span>
                <span className="col-span-1 text-subtle group-hover:text-accent group-hover:translate-x-0.5 transition-all text-right">
                  ↗
                </span>
              </a>
            </li>
          ))}
        </ul>

        <div className="max-w-3xl mx-auto mt-12 border border-default rounded-xl p-6 md:p-8">
          <p className="eyebrow mb-3">notes</p>
          <p className="text-[15px] leading-relaxed">
            for collabs, feedback, or project ideas &mdash; email works best.
            i read everything. if you&apos;re here because you liked something
            and want to steal some CSS, go for it, just don&apos;t claim
            it&apos;s yours.
          </p>
        </div>
      </section>
    </>
  );
}
