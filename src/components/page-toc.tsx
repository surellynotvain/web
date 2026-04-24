"use client";

import { useEffect, useState } from "react";

type Section = { id: string; label: string };

type Props = {
  sections: Section[];
};

/**
 * Left-hand sticky table of contents for the home page.
 * Hidden on mobile. Highlights the currently-visible section via
 * IntersectionObserver. Clicking a link smooth-scrolls to it.
 */
export function PageToc({ sections }: Props) {
  const [active, setActive] = useState<string>(sections[0]?.id ?? "");

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sections.length === 0) return;

    const nodes = sections
      .map((s) => document.getElementById(s.id))
      .filter((el): el is HTMLElement => !!el);

    if (nodes.length === 0) return;

    // Track visibility ratios; pick the section with highest visibility,
    // preferring ones whose top is just below the fixed header.
    const ratios = new Map<string, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          ratios.set(e.target.id, e.intersectionRatio);
        }
        // pick the id with the highest ratio
        let bestId = active;
        let bestRatio = -1;
        for (const [id, r] of ratios) {
          if (r > bestRatio) {
            bestId = id;
            bestRatio = r;
          }
        }
        if (bestRatio > 0) setActive(bestId);
      },
      {
        // ignore top ~80px (fixed nav) and bottom 40% so the active section
        // reflects what's actually centered on screen
        rootMargin: "-80px 0px -40% 0px",
        threshold: [0, 0.25, 0.5, 0.75, 1],
      },
    );

    for (const n of nodes) observer.observe(n);
    return () => observer.disconnect();
    // active is intentionally not a dep — we want "current best" not "on change"
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections]);

  return (
    <nav
      aria-label="page contents"
      className="hidden lg:block sticky top-24 self-start w-56 shrink-0 text-sm"
    >
      <p className="eyebrow mb-4">on this page</p>
      <ul className="space-y-1.5 border-l border-default">
        {sections.map((s) => {
          const isActive = active === s.id;
          return (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                aria-current={isActive ? "location" : undefined}
                className={`block pl-4 py-1 border-l-2 -ml-px transition-colors font-mono text-[12px] ${
                  isActive
                    ? "border-[rgb(var(--accent-light))] text-[rgb(var(--fg))]"
                    : "border-transparent text-subtle hover:text-[rgb(var(--fg))]"
                }`}
              >
                {s.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
