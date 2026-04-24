import "server-only";

// PokéAPI — https://pokeapi.co/
// public, free, no auth. we pick a deterministic pokémon-of-the-day
// based on the current UTC date so every visitor on a given day sees
// the same one.

export type PokemonOfTheDay = {
  id: number;
  name: string;
  types: string[];
  heightDm: number; // decimetres per API
  weightHg: number; // hectograms per API
  spriteUrl: string | null;
  flavorText: string | null;
  apiUrl: string;
};

// generation 1-9 = national dex 1..1025. keeps us away from forms/variants
// at higher IDs that complicate the species lookup.
const MAX_POKEDEX_ID = 1025;

function pokemonIdForToday(): number {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
  // simple deterministic hash (xmur3-ish)
  let h = 0x811c9dc5 | 0;
  for (let i = 0; i < today.length; i++) {
    h = Math.imul(h ^ today.charCodeAt(i), 0x01000193);
  }
  return (Math.abs(h) % MAX_POKEDEX_ID) + 1;
}

function pickEnglishFlavor(
  entries: Array<{ flavor_text: string; language: { name: string } }> | undefined,
): string | null {
  if (!entries) return null;
  const en = entries.find((e) => e.language?.name === "en");
  if (!en) return null;
  // API flavor text contains form-feed chars and odd newlines
  return en.flavor_text.replace(/[\f\n\r]+/g, " ").replace(/\s+/g, " ").trim();
}

export async function getPokemonOfTheDay(): Promise<PokemonOfTheDay | null> {
  const id = pokemonIdForToday();
  try {
    const [pokeRes, speciesRes] = await Promise.all([
      fetch(`https://pokeapi.co/api/v2/pokemon/${id}`, {
        next: { revalidate: 86_400 },
        signal: AbortSignal.timeout(6000),
      }),
      fetch(`https://pokeapi.co/api/v2/pokemon-species/${id}`, {
        next: { revalidate: 86_400 },
        signal: AbortSignal.timeout(6000),
      }),
    ]);

    if (!pokeRes.ok) return null;

    const poke = (await pokeRes.json()) as {
      id: number;
      name: string;
      height: number;
      weight: number;
      types?: Array<{ type: { name: string } }>;
      sprites?: {
        front_default?: string | null;
        other?: {
          ["official-artwork"]?: { front_default?: string | null };
          home?: { front_default?: string | null };
        };
      };
    };

    let flavorText: string | null = null;
    if (speciesRes.ok) {
      const species = (await speciesRes.json()) as {
        flavor_text_entries?: Array<{
          flavor_text: string;
          language: { name: string };
        }>;
      };
      flavorText = pickEnglishFlavor(species.flavor_text_entries);
    }

    const spriteUrl =
      poke.sprites?.other?.["official-artwork"]?.front_default ??
      poke.sprites?.other?.home?.front_default ??
      poke.sprites?.front_default ??
      null;

    return {
      id: poke.id,
      name: poke.name,
      types: poke.types?.map((t) => t.type.name) ?? [],
      heightDm: poke.height,
      weightHg: poke.weight,
      spriteUrl,
      flavorText,
      apiUrl: `https://pokeapi.co/api/v2/pokemon/${poke.name}`,
    };
  } catch (err) {
    console.warn("[pokeapi] fetch failed", err);
    return null;
  }
}
