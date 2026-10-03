import type { MetadataRoute } from "next";

/**
 * The install manifest — what "Add to Home Screen" / "Install app" reads.
 *
 * The icons are generated, not hand-made: `node scripts/gen-favicon.mjs` writes all four
 * into `public/icons/` from the same master as the tab icon. They are split by `purpose`
 * on purpose. A single file declared `"any maskable"` is shown with transparent corners
 * on a launcher that doesn't mask, and cropped by the OS on one that does — it can't be
 * right for both. So `icon-*` keeps the squircle's own shape, and `maskable-*` is an
 * opaque square with the art shrunk into the 80% safe circle, for the OS to cut.
 *
 * Colours are the app's newsprint canvas (`--color-paper`), so the splash screen and the
 * title bar of an installed window are the same sheet the first paint lands on.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "ClubHub",
    short_name: "ClubHub",
    description:
      "Manage tasks, events, domains and members for your student club — with clarity and authority.",
    // /portal rather than /: the root only redirects there, and a standalone window
    // should open on the page it means, not on a hop.
    start_url: "/portal",
    scope: "/",
    display: "standalone",
    background_color: "#f8eedf",
    theme_color: "#f8eedf",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
