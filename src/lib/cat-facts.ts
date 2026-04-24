import "server-only";

// Primary API: https://catfact.ninja/ (HTTPS, reliable, no auth).
// Fallback: https://alexwohlbruck.github.io/cat-facts/docs/ (heroku dyno).
// Both fail → null, caller renders graceful fallback.

export type CatFact = {
  text: string;
  source: "catfact.ninja" | "cat-facts";
  url: string; // attribution link
};

async function tryCatfactNinja(): Promise<CatFact | null> {
  try {
    const res = await fetch("https://catfact.ninja/fact", {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(4000),
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { fact?: string };
    if (!body?.fact) return null;
    return {
      text: body.fact,
      source: "catfact.ninja",
      url: "https://catfact.ninja/",
    };
  } catch {
    return null;
  }
}

async function tryCatFactHeroku(): Promise<CatFact | null> {
  try {
    const res = await fetch(
      "https://cat-fact.herokuapp.com/facts/random?animal_type=cat",
      {
        next: { revalidate: 3600 },
        signal: AbortSignal.timeout(4000),
      },
    );
    if (!res.ok) return null;
    const body = (await res.json()) as { text?: string };
    if (!body?.text) return null;
    return {
      text: body.text,
      source: "cat-facts",
      url: "https://github.com/alexwohlbruck/cat-facts",
    };
  } catch {
    return null;
  }
}

/**
 * Fetch a random cat fact, trying primary API then fallback.
 * Returns null on total failure so callers can render a graceful fallback.
 */
export async function getRandomCatFact(): Promise<CatFact | null> {
  const a = await tryCatfactNinja();
  if (a) return a;
  const b = await tryCatFactHeroku();
  if (b) return b;
  console.warn("[cat-facts] all providers failed");
  return null;
}
