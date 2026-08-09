import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fully static export -> `out/`, uploaded to Cloudflare Pages. This is only possible
  // because the landing page has no dynamic routes, no route handlers, no middleware and
  // makes zero network calls. The app (frontend/) cannot do this: /c/[clubId] has no
  // generateStaticParams, which is why it runs `next start` on the droplet instead.
  output: "export",

  images: {
    // Required by output:"export" — the default next/image optimizer needs a running server.
    // Consequence: anything dropped into public/ (press photos, backdrop clips) is served
    // exactly as authored, so pre-encode at authoring time — AVIF for stills, the
    // backdrop:prep pipeline for clips — rather than relying on a build-time transform.
    // Nothing renders a next/image today: Photo.tsx prints a placeholder until real
    // photography lands in public/press/.
    unoptimized: true,
  },
};

export default nextConfig;
