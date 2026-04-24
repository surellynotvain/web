// server-only helpers for github contribution data
// docs: https://docs.github.com/en/graphql/reference/objects#contributionscollection
import "server-only";

export type ContribDay = {
  date: string; // YYYY-MM-DD
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
};

export type ContribWeek = {
  days: ContribDay[];
};

export type ContribCalendar = {
  totalContributions: number;
  weeks: ContribWeek[];
  username: string;
  from: string;
  to: string;
};

function bucketLevel(count: number, max: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0) return 0;
  if (max <= 0) return 1;
  const ratio = count / max;
  if (ratio > 0.75) return 4;
  if (ratio > 0.5) return 3;
  if (ratio > 0.25) return 2;
  return 1;
}

/**
 * Fetch the contribution calendar for a github user using the GraphQL API.
 * Returns null if the token / username is missing or the request fails —
 * caller should render a graceful fallback.
 */
export async function getGithubContributions(): Promise<ContribCalendar | null> {
  const token = process.env.GITHUB_TOKEN;
  const username = process.env.GITHUB_USERNAME;

  if (!token || !username) return null;

  const query = `
    query ($login: String!) {
      user(login: $login) {
        contributionsCollection {
          contributionCalendar {
            totalContributions
            weeks {
              contributionDays {
                date
                contributionCount
              }
            }
          }
        }
      }
    }
  `;

  try {
    const res = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "User-Agent": "vainie.pl",
      },
      body: JSON.stringify({ query, variables: { login: username } }),
      // cache for an hour — contributions don't change that fast
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      console.warn(`[github] contributions fetch failed: ${res.status}`);
      return null;
    }

    const body = (await res.json()) as {
      data?: {
        user?: {
          contributionsCollection?: {
            contributionCalendar?: {
              totalContributions: number;
              weeks: Array<{
                contributionDays: Array<{ date: string; contributionCount: number }>;
              }>;
            };
          };
        };
      };
      errors?: unknown;
    };

    const cal = body.data?.user?.contributionsCollection?.contributionCalendar;
    if (!cal) {
      console.warn("[github] no contribution calendar in response", body.errors ?? "");
      return null;
    }

    // find max to bucket levels
    let max = 0;
    for (const w of cal.weeks) {
      for (const d of w.contributionDays) {
        if (d.contributionCount > max) max = d.contributionCount;
      }
    }

    const weeks: ContribWeek[] = cal.weeks.map((w) => ({
      days: w.contributionDays.map((d) => ({
        date: d.date,
        count: d.contributionCount,
        level: bucketLevel(d.contributionCount, max),
      })),
    }));

    const allDays = weeks.flatMap((w) => w.days);
    const from = allDays[0]?.date ?? "";
    const to = allDays[allDays.length - 1]?.date ?? "";

    return {
      totalContributions: cal.totalContributions,
      weeks,
      username,
      from,
      to,
    };
  } catch (err) {
    console.warn("[github] contributions fetch error", err);
    return null;
  }
}

// ---------- latest public activity ----------

export type GithubActivity = {
  kind: string;            // PushEvent, CreateEvent, PullRequestEvent...
  repo: string;             // "owner/name"
  repoUrl: string;
  createdAt: string;        // ISO
  summary: string;          // human readable one-liner
  url: string | null;       // link to the relevant thing
};

type RawEvent = {
  id: string;
  type: string;
  repo: { name: string; url: string };
  created_at: string;
  payload?: {
    ref?: string;
    ref_type?: string;
    commits?: Array<{ message: string; sha: string }>;
    action?: string;
    pull_request?: { html_url?: string; title?: string; number?: number };
    issue?: { html_url?: string; title?: string; number?: number };
    forkee?: { full_name?: string };
    release?: { html_url?: string; name?: string; tag_name?: string };
  };
};

function summarize(ev: RawEvent): GithubActivity {
  const repo = ev.repo.name;
  const repoUrl = `https://github.com/${repo}`;
  const p = ev.payload ?? {};

  let summary = `${ev.type} in ${repo}`;
  let url: string | null = repoUrl;

  switch (ev.type) {
    case "PushEvent": {
      const count = p.commits?.length ?? 0;
      const first = p.commits?.[0]?.message?.split("\n")[0] ?? "";
      const branch = (p.ref ?? "").replace(/^refs\/heads\//, "");
      summary = `pushed ${count} commit${count === 1 ? "" : "s"} to ${branch || "main"}${
        first ? ` — ${first.slice(0, 80)}` : ""
      }`;
      const sha = p.commits?.[p.commits.length - 1]?.sha;
      url = sha ? `${repoUrl}/commit/${sha}` : repoUrl;
      break;
    }
    case "CreateEvent": {
      summary = `created ${p.ref_type ?? "thing"} ${p.ref ?? ""} in ${repo}`.trim();
      break;
    }
    case "PullRequestEvent": {
      summary = `${p.action ?? "updated"} PR #${p.pull_request?.number ?? ""}: ${
        p.pull_request?.title ?? ""
      }`.trim();
      url = p.pull_request?.html_url ?? repoUrl;
      break;
    }
    case "IssuesEvent": {
      summary = `${p.action ?? "touched"} issue #${p.issue?.number ?? ""}: ${
        p.issue?.title ?? ""
      }`.trim();
      url = p.issue?.html_url ?? repoUrl;
      break;
    }
    case "ForkEvent": {
      summary = `forked ${repo} → ${p.forkee?.full_name ?? "?"}`;
      break;
    }
    case "ReleaseEvent": {
      summary = `released ${p.release?.tag_name ?? p.release?.name ?? ""} in ${repo}`.trim();
      url = p.release?.html_url ?? repoUrl;
      break;
    }
    case "WatchEvent": {
      summary = `starred ${repo}`;
      break;
    }
    case "PublicEvent": {
      summary = `made ${repo} public`;
      break;
    }
  }

  return {
    kind: ev.type,
    repo,
    repoUrl,
    createdAt: ev.created_at,
    summary,
    url,
  };
}

/**
 * Fetch the single most recent public event for the configured user.
 * Uses GITHUB_TOKEN if present (5000/hr limit) else anonymous (60/hr).
 */
export async function getLatestGithubActivity(): Promise<GithubActivity | null> {
  const username = process.env.GITHUB_USERNAME;
  if (!username) return null;

  const token = process.env.GITHUB_TOKEN;
  try {
    const res = await fetch(
      `https://api.github.com/users/${encodeURIComponent(username)}/events/public?per_page=5`,
      {
        headers: {
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "vainie.pl",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        next: { revalidate: 600 },
        signal: AbortSignal.timeout(5000),
      },
    );
    if (!res.ok) {
      console.warn(`[github] events fetch failed: ${res.status}`);
      return null;
    }
    const events = (await res.json()) as RawEvent[];
    const first = events?.[0];
    if (!first) return null;
    return summarize(first);
  } catch (err) {
    console.warn("[github] events fetch error", err);
    return null;
  }
}
