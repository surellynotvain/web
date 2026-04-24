import { getPlaylist, formatDuration } from "@/lib/tidal";
import { TrackList } from "./track-list";

export async function TidalPlaylist({
  playlistId,
  country = "US",
  limit = 50,
}: {
  playlistId: string;
  country?: string;
  limit?: number;
}) {
  let data;
  try {
    data = await getPlaylist(playlistId, { country, limit });
  } catch (err) {
    // log for debugging but show a graceful UI — works offline / when tidal is down
    console.warn("[tidal] playlist fetch failed:", err);
    return (
      <div className="border border-dashed border-default rounded-xl p-6 md:p-8 bg-surface/40">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="max-w-md">
            <p className="text-base font-medium">playlist unavailable.</p>
            <p className="text-muted text-sm mt-2">
              can&apos;t reach tidal right now. the rest of the site still
              works — you can open the playlist directly on tidal instead.
            </p>
          </div>
          <a
            href={`https://tidal.com/playlist/${playlistId}`}
            target="_blank"
            rel="noreferrer"
            className="btn-ghost"
          >
            open on tidal ↗
          </a>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 md:gap-4 mb-4">
        <div>
          <p className="text-base font-semibold">{data.name}</p>
          {data.description && (
            <p className="text-muted text-xs mt-1 max-w-md">
              {data.description}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 md:gap-3 font-mono text-[11px] text-subtle flex-wrap">
          <span>{data.trackCount} tracks</span>
          <span>·</span>
          <span>{formatDuration(data.durationSec)}</span>
          <span>·</span>
          <a
            href={data.tidalUrl}
            target="_blank"
            rel="noreferrer"
            className="link-accent"
          >
            open in tidal ↗
          </a>
        </div>
      </div>

      <TrackList tracks={data.tracks} />
    </div>
  );
}
