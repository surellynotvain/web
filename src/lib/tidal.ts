// server-only Tidal API helper. never import from client components.
import "server-only";

const TOKEN_ENDPOINT = "https://auth.tidal.com/v1/oauth2/token";
const API_BASE = "https://openapi.tidal.com/v2";

// keep token between requests in the same server process
type CachedToken = { token: string; expiresAt: number };
let cached: CachedToken | null = null;

async function getAccessToken(): Promise<string> {
  const clientId = process.env.TIDAL_CLIENT_ID;
  const clientSecret = process.env.TIDAL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "TIDAL_CLIENT_ID / TIDAL_CLIENT_SECRET missing from environment.",
    );
  }

  if (cached && cached.expiresAt - 60_000 > Date.now()) {
    return cached.token;
  }

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Tidal auth failed: ${res.status} ${txt}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    expires_in: number;
  };

  cached = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  return cached.token;
}

async function tidalFetch<T>(path: string): Promise<T> {
  const token = await getAccessToken();
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.api+json",
    },
    // revalidate in background every 10 minutes
    next: { revalidate: 600 },
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Tidal API ${res.status} on ${path}: ${txt.slice(0, 300)}`);
  }

  return (await res.json()) as T;
}

// ---------- JSON:API types ----------

type JsonApiRef = { id: string; type: string };

type JsonApiResource<A = Record<string, unknown>> = {
  id: string;
  type: string;
  attributes?: A;
  relationships?: Record<
    string,
    { data?: JsonApiRef | JsonApiRef[]; links?: { self?: string } }
  >;
};

type JsonApiDoc<T = unknown, I = unknown> = {
  data: T;
  included?: I[];
  links?: { self?: string; next?: string; prev?: string };
};

type PlaylistAttrs = {
  name?: string;
  description?: string;
  numberOfItems?: number;
  duration?: string;
  externalLinks?: { href: string; meta?: { type?: string } }[];
};

type TrackAttrs = {
  title?: string;
  version?: string | null;
  duration?: string;
  explicit?: boolean;
  externalLinks?: { href: string; meta?: { type?: string } }[];
};

type ArtistAttrs = { name?: string };

type AlbumAttrs = { title?: string };

type ArtworkAttrs = {
  mediaType?: string;
  files?: { href: string; meta?: { width: number; height: number } }[];
};

// ---------- Public shape ----------

export type PlaylistTrack = {
  id: string;
  title: string;
  artists: string;
  album: string | null;
  durationSec: number;
  explicit: boolean;
  cover: string | null;
  tidalUrl: string | null;
};

export type PlaylistData = {
  id: string;
  name: string;
  description: string | null;
  trackCount: number;
  durationSec: number;
  tidalUrl: string;
  tracks: PlaylistTrack[];
};

// parse ISO 8601 duration ("PT3M42S") to seconds
function isoDurationToSeconds(iso: string | undefined): number {
  if (!iso) return 0;
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)(?:\.\d+)?S)?$/.exec(iso);
  if (!m) return 0;
  const [, h, mi, s] = m;
  return (parseInt(h ?? "0") * 3600) + (parseInt(mi ?? "0") * 60) + parseInt(s ?? "0");
}

function pickBestImage(
  files?: { href: string; meta?: { width: number; height: number } }[],
): string | null {
  if (!files || files.length === 0) return null;
  // prefer around 320px; fall back to closest
  const sorted = [...files].sort((a, b) => {
    const aw = a.meta?.width ?? 0;
    const bw = b.meta?.width ?? 0;
    const score = (w: number) => (w >= 200 && w <= 640 ? Math.abs(w - 320) : 10000 + Math.abs(w - 320));
    return score(aw) - score(bw);
  });
  return sorted[0]?.href ?? null;
}

function pickExternalLink(
  links?: { href: string; meta?: { type?: string } }[],
): string | null {
  if (!links || links.length === 0) return null;
  const share = links.find((l) => l.meta?.type === "TIDAL_SHARING");
  return share?.href ?? links[0]?.href ?? null;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function buildFilterQuery(
  ids: string[],
  extra: Record<string, string> = {},
): string {
  // JSON:API uses filter[id]=x repeated per value
  const parts: string[] = [];
  for (const id of ids) parts.push(`filter%5Bid%5D=${encodeURIComponent(id)}`);
  for (const [k, v] of Object.entries(extra)) {
    parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
  }
  return parts.join("&");
}

// ---------- Main fetch ----------

export async function getPlaylist(
  playlistId: string,
  opts: { country?: string; limit?: number } = {},
): Promise<PlaylistData> {
  const country = opts.country ?? "US";
  const limit = opts.limit ?? 50;

  // 1. playlist metadata
  const playlistDoc = await tidalFetch<
    JsonApiDoc<JsonApiResource<PlaylistAttrs>>
  >(`/playlists/${playlistId}?countryCode=${country}`);

  const playlist = playlistDoc.data;

  // 2. track ID list (paginated, but we cap at `limit`)
  const trackIds: string[] = [];
  let nextPath: string | null =
    `/playlists/${playlistId}/relationships/items?countryCode=${country}&page%5Blimit%5D=${Math.min(limit, 100)}`;

  while (nextPath && trackIds.length < limit) {
    const itemsDoc: JsonApiDoc<JsonApiRef[]> = await tidalFetch<
      JsonApiDoc<JsonApiRef[]>
    >(nextPath);

    for (const ref of itemsDoc.data ?? []) {
      if (ref.type === "tracks") trackIds.push(ref.id);
      if (trackIds.length >= limit) break;
    }
    // follow cursor if more pages needed
    nextPath = itemsDoc.links?.next ?? null;
  }

  if (trackIds.length === 0) {
    return {
      id: playlist.id,
      name: playlist.attributes?.name ?? "playlist",
      description: playlist.attributes?.description ?? null,
      trackCount: playlist.attributes?.numberOfItems ?? 0,
      durationSec: isoDurationToSeconds(playlist.attributes?.duration),
      tidalUrl:
        pickExternalLink(playlist.attributes?.externalLinks) ??
        `https://tidal.com/playlist/${playlist.id}`,
      tracks: [],
    };
  }

  // 3. batch-fetch tracks (with albums + artists included)
  type TrackDoc = JsonApiDoc<
    JsonApiResource<TrackAttrs>[],
    JsonApiResource<TrackAttrs | ArtistAttrs | AlbumAttrs>
  >;

  const trackChunks = chunk(trackIds, 20);
  const trackResources: JsonApiResource<TrackAttrs>[] = [];
  const resourceIndex = new Map<
    string,
    JsonApiResource<TrackAttrs | ArtistAttrs | AlbumAttrs>
  >();

  await Promise.all(
    trackChunks.map(async (ids) => {
      const qs = buildFilterQuery(ids, {
        countryCode: country,
        include: "albums,artists",
      });
      const doc = await tidalFetch<TrackDoc>(`/tracks?${qs}`);
      for (const t of doc.data ?? []) trackResources.push(t);
      for (const inc of doc.included ?? []) {
        resourceIndex.set(`${inc.type}:${inc.id}`, inc);
      }
    }),
  );

  // 4. collect album IDs that need artwork, batch-fetch coverArt
  const albumIds = new Set<string>();
  for (const t of trackResources) {
    const albums =
      (t.relationships?.albums?.data as JsonApiRef[] | undefined) ?? [];
    for (const a of albums) albumIds.add(a.id);
  }

  const albumCovers = new Map<string, string>(); // albumId -> cover url

  if (albumIds.size > 0) {
    const albumChunks = chunk([...albumIds], 20);
    await Promise.all(
      albumChunks.map(async (ids) => {
        const qs = buildFilterQuery(ids, {
          countryCode: country,
          include: "coverArt",
        });
        type AlbumDoc = JsonApiDoc<
          JsonApiResource<AlbumAttrs>[],
          JsonApiResource<ArtworkAttrs | AlbumAttrs>
        >;
        const doc = await tidalFetch<AlbumDoc>(`/albums?${qs}`);

        // index artworks
        const artworks = new Map<string, ArtworkAttrs>();
        for (const inc of doc.included ?? []) {
          if (inc.type === "artworks") {
            artworks.set(inc.id, inc.attributes as ArtworkAttrs);
          }
        }

        for (const album of doc.data ?? []) {
          const artRefs =
            (album.relationships?.coverArt?.data as
              | JsonApiRef[]
              | undefined) ?? [];
          const firstArt = artRefs[0];
          if (!firstArt) continue;
          const artwork = artworks.get(firstArt.id);
          const url = pickBestImage(artwork?.files);
          if (url) albumCovers.set(album.id, url);
        }
      }),
    );
  }

  // 5. assemble tracks in the original playlist order
  const trackIndex = new Map<string, JsonApiResource<TrackAttrs>>();
  for (const t of trackResources) trackIndex.set(t.id, t);

  const tracks: PlaylistTrack[] = [];
  for (const id of trackIds) {
    const t = trackIndex.get(id);
    if (!t) continue;

    const albumRef =
      ((t.relationships?.albums?.data as JsonApiRef[] | undefined) ?? [])[0];
    const artistRefs =
      (t.relationships?.artists?.data as JsonApiRef[] | undefined) ?? [];

    const album = albumRef
      ? (resourceIndex.get(`${albumRef.type}:${albumRef.id}`) as
          | JsonApiResource<AlbumAttrs>
          | undefined)
      : undefined;

    const artistNames = artistRefs
      .map(
        (r) =>
          resourceIndex.get(`${r.type}:${r.id}`) as
            | JsonApiResource<ArtistAttrs>
            | undefined,
      )
      .map((a) => a?.attributes?.name)
      .filter(Boolean) as string[];

    tracks.push({
      id: t.id,
      title: t.attributes?.title ?? "(untitled)",
      artists: artistNames.join(", ") || "—",
      album: album?.attributes?.title ?? null,
      durationSec: isoDurationToSeconds(t.attributes?.duration),
      explicit: Boolean(t.attributes?.explicit),
      cover: albumRef ? albumCovers.get(albumRef.id) ?? null : null,
      tidalUrl: pickExternalLink(t.attributes?.externalLinks),
    });
  }

  return {
    id: playlist.id,
    name: playlist.attributes?.name ?? "playlist",
    description: playlist.attributes?.description ?? null,
    trackCount: playlist.attributes?.numberOfItems ?? tracks.length,
    durationSec: isoDurationToSeconds(playlist.attributes?.duration),
    tidalUrl:
      pickExternalLink(playlist.attributes?.externalLinks) ??
      `https://tidal.com/playlist/${playlist.id}`,
    tracks,
  };
}

export function formatDuration(totalSeconds: number): string {
  if (!totalSeconds || !Number.isFinite(totalSeconds)) return "0:00";
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}
