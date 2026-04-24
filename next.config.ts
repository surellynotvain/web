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
