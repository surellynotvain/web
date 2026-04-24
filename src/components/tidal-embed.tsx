"use client";

import { useState } from "react";

export function TidalEmbed({ playlistId }: { playlistId: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-default rounded-xl overflow-hidden bg-surface">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="w-full flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-4 px-4 md:px-5 py-4 text-left hover:bg-app/60 transition-colors"
        >
          <div className="flex items-center gap-3 md:gap-4">
            <div
              className="h-10 w-10 rounded-full flex items-center justify-center shrink-0"
              style={{ background: "rgb(var(--accent))" }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="rgb(var(--bg))"
              >
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium">play previews in browser</p>
              <p className="text-muted text-xs mt-0.5 leading-snug">
                tidal player · ~30s previews · full tracks if you&apos;re
                logged in
              </p>
            </div>
          </div>
          <span className="font-mono text-[11px] text-subtle md:shrink-0">
            click to load →
          </span>
        </button>
      ) : (
        <iframe
          src={`https://embed.tidal.com/playlists/${playlistId}?layout=gridify`}
          width="100%"
          height="480"
          allow="encrypted-media"
          title="tidal player"
          className="block border-0"
        />
      )}
    </div>
  );
}
