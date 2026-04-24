import "server-only";

// Wikipedia page summary endpoint (REST v1).
// https://en.wikipedia.org/api/rest_v1/#/Page%20content/get_page_summary__title_
// Public, no auth, CORS open. Content is CC BY-SA 4.0 — must credit.

export type WikiSummary = {
  title: string;
  extract: string;       // 1-3 sentence plain-text summary
  url: string;           // canonical wikipedia URL
  thumbnail: string | null;
};

/**
 * Fetch the summary of a wikipedia article by page title.
 * Failures return null so callers render a graceful fallback.
 */
export async function getWikiSummary(title: string): Promise<WikiSummary | null> {
  const slug = encodeURIComponent(title.replace(/ /g, "_"));
  const endpoint = `https://en.wikipedia.org/api/rest_v1/page/summary/${slug}`;
  try {
    const res = await fetch(endpoint, {
      headers: {
        Accept: "application/json",
        "User-Agent": "vainie.pl (contact: hi@vainie.pl)",
      },
      next: { revalidate: 86_400 },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      title?: string;
      extract?: string;
      content_urls?: { desktop?: { page?: string } };
      thumbnail?: { source?: string };
      type?: string;
    };
    if (body.type === "disambiguation" || !body.extract) return null;
    return {
      title: body.title ?? title,
      extract: body.extract,
      url:
        body.content_urls?.desktop?.page ??
        `https://en.wikipedia.org/wiki/${slug}`,
      thumbnail: body.thumbnail?.source ?? null,
    };
  } catch (err) {
    console.warn(`[wikipedia] fetch failed for "${title}"`, err);
    return null;
  }
}

/**
 * Try several candidate page titles in order, return the first that works.
 * Useful when a concept has multiple reasonable spellings.
 */
export async function getWikiSummaryAny(
  titles: string[],
): Promise<WikiSummary | null> {
  for (const t of titles) {
    const s = await getWikiSummary(t);
    if (s) return s;
  }
  return null;
}
