import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "resources.tidal.com" },
      { protocol: "https", hostname: "images.tidal.com" },
      { protocol: "https", hostname: "**.tidal.com" },
      // PokéAPI sprites
      { protocol: "https", hostname: "raw.githubusercontent.com" },
      // Wikipedia thumbnails
      { protocol: "https", hostname: "upload.wikimedia.org" },
      // OAuth provider avatars
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "lh4.googleusercontent.com" },
      { protocol: "https", hostname: "lh5.googleusercontent.com" },
      { protocol: "https", hostname: "lh6.googleusercontent.com" },
      // Vercel Blob storage (image uploads when deployed on Vercel)
      { protocol: "https", hostname: "**.public.blob.vercel-storage.com" },
    ],
  },
  async redirects() {
    return [
      // /about now lives as a section on the home page
      { source: "/about", destination: "/#about", permanent: true },
    ];
  },
};

export default nextConfig;
