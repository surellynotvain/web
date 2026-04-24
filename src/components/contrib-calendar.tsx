import { getGithubContributions } from "@/lib/github";

const LEVEL_CLASS: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: "bg-surface",
  1: "bg-[rgb(var(--accent)/0.25)]",
  2: "bg-[rgb(var(--accent)/0.5)]",
  3: "bg-[rgb(var(--accent)/0.75)]",
  4: "bg-[rgb(var(--accent))]",
};

function formatDate(iso: string): string {
  if (!iso) return "";
  try {
    return new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export async function ContribCalendar() {
  const data = await getGithubContributions();

  if (!data) {
    return (
      <div className="border border-default rounded-xl p-5 bg-surface/40">
        <p className="text-subtle text-sm font-mono">
          — github contributions unavailable
        </p>
      </div>
    );
  }

  const { weeks, totalContributions, username, from, to } = data;

  return (
    <div className="border border-default rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-default bg-surface flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-[10px] uppercase tracking-widest text-subtle">
          github — {totalContributions.toLocaleString()} contributions
        </span>
        <a
          href={`https://github.com/${username}`}
          target="_blank"
          rel="noreferrer"
          className="font-mono text-[10px] text-subtle hover:text-accent transition-colors"
        >
          @{username} ↗
        </a>
      </div>

      <div className="p-5 overflow-x-auto">
        <div
          role="img"
          aria-label={`GitHub contributions from ${formatDate(from)} to ${formatDate(to)}: ${totalContributions} total`}
          className="flex gap-[3px] min-w-max"
        >
          {weeks.map((w, wi) => (
            <div key={wi} className="flex flex-col gap-[3px]">
              {w.days.map((d) => (
                <div
                  key={d.date}
                  title={`${d.count} contribution${d.count === 1 ? "" : "s"} on ${formatDate(d.date)}`}
                  className={`h-[11px] w-[11px] rounded-sm ${LEVEL_CLASS[d.level]}`}
                />
              ))}
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-center gap-2 text-[10px] font-mono text-subtle">
          <span>less</span>
          {([0, 1, 2, 3, 4] as const).map((lvl) => (
            <div key={lvl} className={`h-[11px] w-[11px] rounded-sm ${LEVEL_CLASS[lvl]}`} />
          ))}
          <span>more</span>
        </div>
      </div>
    </div>
  );
}
