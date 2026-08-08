import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fully static export -> `out/`, uploaded to Cloudflare Pages. This is only possible
  // because the landing page has no dynamic routes, no route handlers, no middleware and
  // makes zero network calls. The app (frontend/) cannot do this: /c/[clubId] has no
  // generateStaticParams, which is why it runs `next start` on the droplet instead.
  output: "export",

  images: {
    // Required by output:"export" — the default next/image optimizer needs a running server.
    // Consequence: anything dropped into public/desk or public/press is served exactly as
    // authored, so pre-encode it (AVIF with a WebP fallback) at authoring time rather than
    // relying on a build-time transform. Nothing renders an image today: deskAssets.ts leaves
    // `plate` undefined and DESK_PROPS empty, and Photo.tsx falls back to a printed placeholder.
    unoptimized: true,
  },
};

export default nextConfig;
