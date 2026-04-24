import Image from "next/image";
import { formatDuration, type PlaylistTrack } from "@/lib/tidal";

export function TrackList({ tracks }: { tracks: PlaylistTrack[] }) {
  if (tracks.length === 0) {
    return (
      <div className="border border-dashed border-default rounded-xl p-8 text-center">
        <p className="text-muted text-sm">no tracks in this playlist yet.</p>
      </div>
    );
  }

  return (
    <div className="border border-default rounded-xl overflow-hidden bg-app">
      {/* header row */}
      <div className="hidden md:grid grid-cols-[2.5rem_1fr_1fr_auto] items-center gap-4 px-5 py-3 border-b border-default bg-surface">
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-subtle">
          #
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-subtle">
          title
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-subtle">
          album
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-subtle">
          time
        </span>
      </div>

      {/* scrollable list */}
      <ul className="max-h-[480px] overflow-y-auto divide-y divide-default">
        {tracks.map((t, i) => {
          const row = (
            <div className="grid grid-cols-[auto_1fr_auto] md:grid-cols-[2.5rem_1fr_1fr_auto] items-center gap-3 md:gap-4 px-4 md:px-5 py-3 hover:bg-surface transition-colors">
              <span className="font-mono text-xs text-subtle tabular-nums">
                {String(i + 1).padStart(2, "0")}
              </span>

              <div className="flex items-center gap-3 min-w-0">
                {t.cover ? (
                  <Image
                    src={t.cover}
                    alt=""
                    width={36}
                    height={36}
                    sizes="36px"
                    className="rounded-sm object-cover shrink-0"
                  />
                ) : (
                  <div className="h-9 w-9 rounded-sm bg-surface shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    {t.title}
                    {t.explicit && (
                      <span className="ml-1.5 font-mono text-[9px] px-1 py-0.5 rounded bg-surface border border-default text-subtle align-middle">
                        E
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted truncate">{t.artists}</p>
                </div>
              </div>

              <p className="hidden md:block text-xs text-muted truncate">
                {t.album ?? "—"}
              </p>

              <span className="font-mono text-xs text-subtle tabular-nums shrink-0">
                {formatDuration(t.durationSec)}
              </span>
            </div>
          );

          return (
            <li key={t.id}>
              {t.tidalUrl ? (
                <a
                  href={t.tidalUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="block"
                >
                  {row}
                </a>
              ) : (
                row
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
