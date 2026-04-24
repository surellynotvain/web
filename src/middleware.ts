import { NextResponse } from "next/server";

export const config = {
  // run on all routes except next's internals + static files
  matcher: ["/((?!_next/static|_next/image|favicon|uploads/).*)"],
};

export function middleware() {
  const res = NextResponse.next();

  // security headers — applied to everything
  const headers = res.headers;

  // content security policy — keep permissive enough for embeds + uploads
  // adjust if you add new external hosts
  const csp = [
    "default-src 'self'",
    // next.js inlines some styles/scripts, and we use next/font
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    // tidal, github avatars, google avatars, pokéapi sprites, wikipedia thumbnails, our uploads
    "img-src 'self' data: blob: https://resources.tidal.com https://*.tidal.com https://images.tidal.com https://avatars.githubusercontent.com https://raw.githubusercontent.com https://graph.microsoft.com https://upload.wikimedia.org https://lh3.googleusercontent.com https://lh4.googleusercontent.com https://lh5.googleusercontent.com https://lh6.googleusercontent.com",
    // tidal embed player + oauth redirects
    "frame-src https://embed.tidal.com https://*.tidal.com",
    // server-side fetches only; we allow openrouter for the ai writing assistant
    "connect-src 'self' https://openapi.tidal.com https://auth.tidal.com https://api.github.com https://en.wikipedia.org https://cat-fact.herokuapp.com https://catfact.ninja https://pokeapi.co",
    "font-src 'self' data:",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self' https://github.com https://login.microsoftonline.com https://accounts.google.com",
  ].join("; ");

  headers.set("Content-Security-Policy", csp);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  );
  headers.set("X-DNS-Prefetch-Control", "off");

  return res;
}
