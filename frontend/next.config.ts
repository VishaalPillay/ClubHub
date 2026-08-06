import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit .next/standalone — a self-contained server.js plus only the node_modules actually
  // reached. That is what frontend/Dockerfile copies into the runtime stage, which keeps the
  // web image small enough to rebuild comfortably on a 2 GB droplet.
  //
  // This app cannot use output:"export" the way landing/ does: /c/[clubId] is a dynamic
  // segment with no generateStaticParams, so it needs a Node server at request time.
  output: "standalone",

  // No `images` config: next/image was only ever used by the newspaper landing page, which
  // now lives in landing/ with its own (unoptimized) settings. Nothing in this app renders
  // an <Image>, so an optimizer config here would be dead weight.
};

export default nextConfig;
